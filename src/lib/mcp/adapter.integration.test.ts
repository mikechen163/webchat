import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { callMcpProvider } from './adapter';
import fetch from 'node-fetch';

let serverProc: ChildProcessWithoutNullStreams | null = null;

function waitForServerOutput(proc: ChildProcessWithoutNullStreams, marker: string, timeout = 5000) {
  return new Promise<void>((resolve, reject) => {
    let acc = '';
    const t = setTimeout(() => {
      proc.stdout.removeAllListeners('data');
      proc.stderr.removeAllListeners('data');
      reject(new Error('timeout waiting for server'));
    }, timeout);

    function onData(chunk: Buffer) {
      acc += chunk.toString();
      if (acc.includes(marker)) {
        clearTimeout(t);
        proc.stdout.removeAllListeners('data');
        proc.stderr.removeAllListeners('data');
        resolve();
      }
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
  });
}

beforeAll(async () => {
  // Try Python MCP server first, fall back to Node fallback server if Python not available
  const pyScript = path.resolve(process.cwd(), 'server', 'mcp_server.py');
  const nodeScript = path.resolve(process.cwd(), 'server', 'mcp_fallback_server.cjs');
  const tryPy = ['python3', 'python'];
  let started = false;

  for (const cmd of tryPy) {
    try {
      serverProc = spawn(cmd, [pyScript], { cwd: process.cwd(), env: { ...process.env, MCP_FALLBACK_PORT: '33333', FORCE_MCP_FALLBACK: '1' } });
      // give process a moment to start
      await new Promise((r) => setTimeout(r, 300));
      started = true;
      break;
    } catch (e) {
      if (serverProc) {
        try { serverProc.kill('SIGINT'); } catch {};
        serverProc = null;
      }
    }
  }

  if (!started) {
    serverProc = spawn(process.execPath, [nodeScript], { cwd: process.cwd(), env: { ...process.env, MCP_FALLBACK_PORT: '33333' } });
  }

  // Poll the HTTP endpoint until ready
  const url = 'http://127.0.0.1:33333';
  const deadline = Date.now() + 10000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [] }) });
      if (r && r.status === 200) { ok = true; break; }
    } catch (e) {
      // ignore
    }
    // wait a bit
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!ok) {
    if (serverProc) {
      try { serverProc.kill('SIGINT'); } catch {};
      serverProc = null;
    }
    throw new Error('Failed to start any fallback server');
  }
});

afterAll(() => {
  if (serverProc) {
    serverProc.kill('SIGINT');
    serverProc = null;
  }
});

describe('MCP adapter integration', () => {
  it('calls the real fallback Python MCP server over HTTP and receives SSE chunks', async () => {
    const res = await callMcpProvider({ id: 'py', name: 'py-mcp', baseUrl: 'http://127.0.0.1:33333' }, [
      { role: 'user', content: 'integration test' }
    ]);

    expect(res.ok).toBeTruthy();
    expect(res.body).toBeDefined();

    const reader = (res as any).body.getReader();

    let collected = '';
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      if (value) collected += new TextDecoder().decode(value);
    }

    expect(collected.length).toBeGreaterThan(0);
    expect(collected).toContain('echo: integration test');
  }, 10000);
});
