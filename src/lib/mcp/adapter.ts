import fetch from 'node-fetch';
import WebSocket from 'ws';
import { createMockMcpResponse } from './mockClient';
import { processManager } from './process-manager';
import type { McpTool, McpToolCallResult } from './types';

export type McpProviderConfig = {
  id?: string;
  name?: string;
  baseUrl?: string;
  command?: string | null;   // Stdio: command to execute
  args?: string | null;       // Stdio: JSON array of arguments
  apiKey?: string | null;
  wsPath?: string | null;
  transport?: 'http' | 'ws' | 'stdio';
};

function makeSseReaderFromChunks(chunks: Uint8Array[]) {
  let idx = 0;
  return {
    async read() {
      if (idx >= chunks.length) return { done: true, value: undefined } as any;
      const value = chunks[idx++];
      return { done: false, value };
    }
  };
}

/**
 * Perform HTTP POST to MCP endpoint and return object compatible with existing stream processing.
 * Expect MCP HTTP endpoint to stream SSE-like `data: {...}\n\n` chunks.
 */
async function callHttpMcp(baseUrl: string, apiKey: string | null, body: any) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!res.body) {
    // no streaming body; wrap full text as single chunk
    const text = await res.text();
    const encoder = new TextEncoder();
    const chunks = [encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`), encoder.encode('data: [DONE]\n\n')];
    return { ok: res.ok, body: { getReader() { return makeSseReaderFromChunks(chunks); } } } as const;
  }

  // If response.body exists, try to return object with getReader that proxies node stream's reader
  // node-fetch v3 body is a web stream in Node >=18, so it supports getReader()
  // @ts-ignore - forward the underlying body if it has getReader
  if ((res.body as any).getReader) return res as any;

  // Fallback: consume and re-emit as chunks
  const buf = await res.text();
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(buf), encoder.encode('data: [DONE]\n\n')];
  return { ok: res.ok, body: { getReader() { return makeSseReaderFromChunks(chunks); } } } as const;
}

/**
 * Call MCP over WebSocket. This implementation opens a WS, sends a JSON request and
 * wraps incoming messages as SSE-style chunks.
 */
function callWsMcp(url: string, apiKey: string | null, requestPayload: any) {
  const ws = new WebSocket(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined
  });

  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  let openPromise: Promise<void> = new Promise((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', (err) => reject(err));
  });

  // Collect messages
  ws.on('message', (data) => {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data as Buffer);
    // wrap line similar to SSE: data: {json}\n\n
    chunks.push(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
  });

  // When closed, append [DONE]
  ws.on('close', () => {
    chunks.push(encoder.encode('data: [DONE]\n\n'));
  });

  const promise = (async () => {
    await openPromise;
    // send request as JSON string
    ws.send(JSON.stringify(requestPayload));
    // return Response-like
    return { ok: true, body: { getReader() { return makeSseReaderFromChunks(chunks); } } } as const;
  })();

  return promise;
}

/**
 * callMcpProvider: supports HTTP and WS transports.
 * - If baseUrl contains 'mock' uses mock response (for tests).
 * - If baseUrl starts with ws:// or wss:// uses WebSocket transport.
 * - Otherwise, performs POST to baseUrl and returns streaming-like object.
 */
export async function callMcpProvider(
  config: McpProviderConfig,
  messages: Array<{ role: string; content: string }>
) {
  const base = (config.baseUrl || '').trim();
  const apiKey = config.apiKey || null;

  const payload = { messages };

  if (base.includes('mock')) {
    const joined = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const reply = `Mock MCP reply for provider=${config.name || config.id}\n\nReply to:\n${joined}`;
    return createMockMcpResponse(reply);
  }

  try {
    if (base.startsWith('ws://') || base.startsWith('wss://')) {
      return await callWsMcp(base, apiKey, payload);
    }

    // Default: HTTP POST
    return await callHttpMcp(base, apiKey, payload);
  } catch (e) {
    // On error, fallback to a mock response indicating error
    const encoder = new TextEncoder();
    const msg = `ERROR contacting MCP: ${e instanceof Error ? e.message : String(e)}`;
    const chunks = [encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`), encoder.encode('data: [DONE]\n\n')];
    return { ok: false, body: { getReader() { return makeSseReaderFromChunks(chunks); } } } as const;
  }
}

/**
 * Discover available tools from an MCP server.
 * Supports HTTP, WebSocket, and Stdio transport.
 */
export async function discoverMcpTools(config: McpProviderConfig): Promise<McpTool[]> {
  // Handle Stdio transport
  if (config.transport === 'stdio') {
    return discoverStdioMcpTools(config);
  }

  const base = (config.baseUrl || '').trim();
  const apiKey = config.apiKey || null;

  if (!base) {
    throw new Error('MCP server baseUrl is required');
  }

  // Handle mock servers for testing
  if (base.includes('mock')) {
    return [
      { name: 'mock_tool', description: 'A mock tool for testing', inputSchema: { type: 'object', properties: {} } }
    ];
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  };

  // List of endpoints to try in order
  const endpoints = [
    { url: base.endsWith('/') ? `${base}tools` : `${base}/tools`, method: 'GET' },
    { url: base.endsWith('/') ? `${base}tools/list` : `${base}/tools/list`, method: 'GET' },
    { url: base.endsWith('/') ? `${base}tools` : `${base}/tools`, method: 'POST', body: { action: 'list' } }
  ];

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        method: endpoint.method,
        headers,
        ...(endpoint.body ? { body: JSON.stringify(endpoint.body) } : {}),
        // @ts-ignore - timeout for node-fetch
        timeout: 10000
      });

      if (res.ok) {
        const data = await res.json() as any;
        // Handle different response formats
        if (Array.isArray(data)) {
          return data;
        }
        if (data.tools && Array.isArray(data.tools)) {
          return data.tools;
        }
        // Empty but successful - continue to next endpoint
      }
    } catch (e) {
      lastError = e as Error;
      // Continue to next endpoint
    }
  }

  // If all endpoints failed
  if (lastError) {
    throw new Error(`Failed to discover tools: ${lastError.message}`);
  }

  return [];
}

/**
 * Call a specific tool on an MCP server.
 * Supports HTTP, WebSocket, and Stdio transport.
 */
export async function callMcpTool(
  config: McpProviderConfig,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolCallResult> {
  // Handle Stdio transport
  if (config.transport === 'stdio') {
    return callStdioMcpTool(config, toolName, args);
  }

  const base = (config.baseUrl || '').trim();
  const apiKey = config.apiKey || null;

  if (!base) {
    return { success: false, error: 'MCP server baseUrl is required' };
  }

  // Handle mock servers for testing
  if (base.includes('mock')) {
    return {
      success: true,
      result: `Mock result for tool ${toolName} with args: ${JSON.stringify(args)}`
    };
  }

  try {
    // Call tool endpoint: /tools/{toolName}
    const toolUrl = base.endsWith('/') ? `${base}tools/${toolName}` : `${base}/tools/${toolName}`;
    const res = await fetch(toolUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(args),
      // @ts-ignore
      timeout: 300000 // 5 minute timeout for tool execution
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        error: `Tool call failed with status ${res.status}: ${errorText}`
      };
    }

    const data = await res.json() as any;

    // Handle different response formats
    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      result: data.result ?? data.output ?? data.items ?? data
    };
  } catch (e) {
    console.error(`Error calling MCP tool ${toolName}:`, e);
    return {
      success: false,
      error: `Tool call error: ${e instanceof Error ? e.message : String(e)}`
    };
  }
}

/**
 * Discover tools from a Stdio MCP server.
 * Spawns the process if not already running, then queries for tools.
 */
async function discoverStdioMcpTools(config: McpProviderConfig): Promise<McpTool[]> {
  if (!config.id) {
    throw new Error('MCP server id is required for Stdio transport');
  }
  if (!config.command) {
    throw new Error('MCP server command is required for Stdio transport');
  }

  // Parse args from JSON string
  let argsArray: string[] = [];
  if (config.args) {
    try {
      argsArray = JSON.parse(config.args);
    } catch (e) {
      console.error('Failed to parse MCP args:', e);
      argsArray = [];
    }
  }

  try {
    // Spawn or get existing process
    await processManager.spawn({
      id: config.id,
      command: config.command,
      args: argsArray
    });

    // List tools from the process
    const tools = await processManager.listTools(config.id);
    return tools;
  } catch (e) {
    console.error('Error discovering Stdio MCP tools:', e);
    throw new Error(`Failed to discover Stdio tools: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Call a tool on a Stdio MCP server.
 */
async function callStdioMcpTool(
  config: McpProviderConfig,
  toolName: string,
  args: Record<string, any>
): Promise<McpToolCallResult> {
  if (!config.id) {
    return { success: false, error: 'MCP server id is required for Stdio transport' };
  }
  if (!config.command) {
    return { success: false, error: 'MCP server command is required for Stdio transport' };
  }

  // Parse args from JSON string
  let argsArray: string[] = [];
  if (config.args) {
    try {
      argsArray = JSON.parse(config.args);
    } catch (e) {
      console.error('Failed to parse MCP args:', e);
    }
  }

  try {
    // Ensure process is running
    if (!processManager.isRunning(config.id)) {
      await processManager.spawn({
        id: config.id,
        command: config.command,
        args: argsArray
      });
    }

    // Call the tool
    const result = await processManager.callTool(config.id, toolName, args);

    // Parse result content
    let resultContent: string;
    if (result?.content && Array.isArray(result.content)) {
      resultContent = result.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
    } else {
      resultContent = JSON.stringify(result);
    }

    return {
      success: true,
      result: resultContent
    };
  } catch (e) {
    console.error(`Error calling Stdio MCP tool ${toolName}:`, e);
    return {
      success: false,
      error: `Stdio tool call error: ${e instanceof Error ? e.message : String(e)}`
    };
  }
}
