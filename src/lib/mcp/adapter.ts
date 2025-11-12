/**
 * MCP适配器 - 增强版
 * 支持多种传输协议的MCP通信
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';
import { createMockMcpResponse } from './mockClient';
import type { 
  McpProviderConfig, 
  McpMessage, 
  McpRequest, 
  McpServerConfig,
  McpTransport 
} from './types';
import { MCP_ERROR_CODES } from './types';
import { McpServerError, createMcpError } from './errors';

/**
 * SSE读取器 - 从数据块创建流式读取器
 */
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
 * HTTP MCP客户端
 * 通过HTTP POST与MCP服务器通信，支持SSE流式响应
 */
async function callHttpMcp(
  baseUrl: string, 
  apiKey: string | null, 
  body: McpRequest
) {
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new McpServerError(
        `HTTP ${response.status}: ${response.statusText}`,
        MCP_ERROR_CODES.TRANSPORT_ERROR,
        response.status
      );
    }

    if (!response.body) {
      // 没有流式响应体，包装完整文本为单个数据块
      const text = await response.text();
      const encoder = new TextEncoder();
      const chunks = [
        encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
        encoder.encode('data: [DONE]\n\n')
      ];
      
      return { 
        ok: response.ok, 
        body: { getReader() { return makeSseReaderFromChunks(chunks); } } 
      } as const;
    }

    // 如果响应体存在，返回支持getReader的对象
    // node-fetch v3 body在Node >=18中是Web流，支持getReader()
    // @ts-ignore - 转发底层body（如果支持getReader）
    if ((response.body as any).getReader) {
      return response as any;
    }

    // 回退：消费并重新分块发送
    const buf = await response.text();
    const encoder = new TextEncoder();
    const chunks = [encoder.encode(buf), encoder.encode('data: [DONE]\n\n')];
    
    return { 
      ok: response.ok, 
      body: { getReader() { return makeSseReaderFromChunks(chunks); } } 
    } as const;
  } catch (error) {
    throw createMcpError(error, 'HTTP MCP call failed');
  }
}

/**
 * WebSocket MCP客户端
 * 通过WebSocket与MCP服务器通信，包装消息为SSE格式
 */
function callWsMcp(
  url: string, 
  apiKey: string | null, 
  requestPayload: McpRequest
) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(url, {
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : undefined
      });

      const chunks: Uint8Array[] = [];
      const encoder = new TextEncoder();
      let isResolved = false;

      // 连接打开时发送请求
      ws.on('open', () => {
        ws.send(JSON.stringify(requestPayload));
      });

      // 收集消息
      ws.on('message', (data) => {
        try {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as Buffer);
          
          // 包装为SSE格式: data: {json}\n\n
          chunks.push(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
        } catch (e) {
          console.error('WebSocket message processing error:', e);
        }
      });

      // 连接关闭时完成
      ws.on('close', () => {
        if (!isResolved) {
          chunks.push(encoder.encode('data: [DONE]\n\n'));
          
          resolve({
            ok: true,
            body: {
              getReader() {
                return makeSseReaderFromChunks(chunks);
              }
            }
          });
          isResolved = true;
        }
      });

      // 错误处理
      ws.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          reject(new McpServerError(
            `WebSocket error: ${err.message}`,
            MCP_ERROR_CODES.TRANSPORT_ERROR,
            500
          ));
        }
      });

      // 超时处理
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          ws.close();
          reject(new McpServerError(
            'WebSocket connection timeout',
            MCP_ERROR_CODES.TIMEOUT,
            408
          ));
        }
      }, 30000); // 30秒超时

      ws.on('close', () => {
        clearTimeout(timeout);
      });

    } catch (error) {
      reject(createMcpError(error, 'WebSocket MCP call setup failed'));
    }
  });
}

/**
 * 增强的MCP提供商调用函数
 * 支持多种传输方式：HTTP、WebSocket、Stdio
 * 支持自定义MCP服务器配置
 */
export async function callMcpProvider(
  config: McpProviderConfig,
  messages: McpMessage[]
): Promise<{ ok: boolean; body: { getReader(): any } }> {
  const baseUrl = (config.baseUrl || '').trim();
  const apiKey = config.apiKey || null;

  // 构建请求载荷
  const payload: McpRequest = { messages };

  try {
    // 模拟响应（用于测试）
    if (baseUrl.includes('mock')) {
      const joined = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const reply = `Mock MCP reply for provider=${config.name || config.id}\n\nReply to:\n${joined}`;
      return createMockMcpResponse(reply);
    }

    // 根据URL协议选择传输方式
    if (baseUrl.startsWith('ws://') || baseUrl.startsWith('wss://')) {
      return await callWsMcp(baseUrl, apiKey, payload);
    }

    // 默认使用HTTP传输
    return await callHttpMcp(baseUrl, apiKey, payload);
    
  } catch (error) {
    // 错误时返回模拟的错误响应
    const encoder = new TextEncoder();
    const msg = `ERROR contacting MCP: ${error instanceof Error ? error.message : String(error)}`;
    const chunks = [
      encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\n`),
      encoder.encode('data: [DONE]\n\n')
    ];
    
    return { 
      ok: false, 
      body: { getReader() { return makeSseReaderFromChunks(chunks); } } 
    } as const;
  }
}

/**
 * 自定义MCP服务器调用函数
 * 支持用户配置的MCP服务器
 */
export async function callCustomMcpProvider(
  serverConfig: McpServerConfig,
  messages: McpMessage[]
): Promise<{ ok: boolean; body: { getReader(): any } }> {
  try {
    // 构建提供商配置
    const providerConfig: McpProviderConfig = {
      id: serverConfig.id,
      name: serverConfig.name,
      baseUrl: serverConfig.baseUrl || undefined,
      apiKey: serverConfig.apiKey,
      serverConfig
    };

    // 根据传输方式调用
    switch (serverConfig.transport) {
      case 'http':
      case 'websocket':
        return await callMcpProvider(providerConfig, messages);
        
      case 'stdio':
        // Stdio传输需要特殊的处理，将在单独的文件中实现
        throw new McpServerError(
          'Stdio transport not yet implemented in adapter',
          MCP_ERROR_CODES.TRANSPORT_ERROR,
          501
        );
        
      default:
        throw new McpServerError(
          `Unsupported transport: ${serverConfig.transport}`,
          MCP_ERROR_CODES.TRANSPORT_ERROR,
          400
        );
    }
  } catch (error) {
    if (error instanceof McpServerError) {
      throw error;
    }
    throw createMcpError(error, 'Custom MCP provider call failed');
  }
}

/**
 * 构建工具描述信息
 * 用于向LLM报告可用的MCP工具
 */
export function buildToolDescription(serverConfig: McpServerConfig): string {
  let description = `Available MCP tools from server "${serverConfig.name}":\n\n`;
  
  if (serverConfig.config?.tools && Array.isArray(serverConfig.config.tools)) {
    serverConfig.config.tools.forEach((tool: any) => {
      description += `Tool: ${tool.name}\n`;
      description += `Description: ${tool.description}\n`;
      
      if (tool.inputSchema) {
        description += `Parameters: ${JSON.stringify(tool.inputSchema, null, 2)}\n`;
      }
      
      description += '\n';
    });
  } else {
    description += 'No tools configured for this MCP server.\n';
  }
  
  return description;
}

/**
 * 验证MCP提供商配置
 */
export function validateMcpProviderConfig(config: McpProviderConfig): void {
  if (!config.baseUrl && !config.serverConfig) {
    throw new McpServerError(
      'Either baseUrl or serverConfig must be provided',
      MCP_ERROR_CODES.VALIDATION_ERROR,
      400
    );
  }
  
  if (config.baseUrl) {
    try {
      const url = new URL(config.baseUrl);
      
      if (url.protocol !== 'http:' && url.protocol !== 'https:' && 
          url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        throw new McpServerError(
          'Invalid protocol. Must be http, https, ws, or wss',
          MCP_ERROR_CODES.VALIDATION_ERROR,
          400
        );
      }
    } catch (error) {
      throw new McpServerError(
        'Invalid baseUrl format',
        MCP_ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }
  }
}