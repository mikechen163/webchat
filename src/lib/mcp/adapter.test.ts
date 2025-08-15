import { describe, it, expect } from 'vitest';
import { callMcpProvider } from './adapter';

describe('MCP adapter (mock)', () => {
  it('returns an object with ok and body.getReader', async () => {
    const res = await callMcpProvider({ id: 'mock1', name: 'mock', baseUrl: 'https://mock' }, [
      { role: 'user', content: 'Hello' }
    ]);

    expect(res).toHaveProperty('ok', true);
    expect(res).toHaveProperty('body');
    expect(typeof (res as any).body.getReader).toBe('function');

    const reader = (res as any).body.getReader();
    expect(typeof reader.read).toBe('function');

    // read all chunks
    let chunks = '';
    // read up to 50 iterations to avoid infinite loop
    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks += new TextDecoder().decode(value);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks).toContain('Mock MCP reply');
  });
});
