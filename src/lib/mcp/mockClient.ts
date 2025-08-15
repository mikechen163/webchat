// Minimal mock MCP client for integration tests.
// Exposes a function that returns a Response-like object with a `body.getReader()`
// compatible with the existing chat stream reader loop.

export function createMockMcpResponse(text: string, chunkSize = 24, delayMs = 30) {
  const encoder = new TextEncoder();

  // Prepare chunks
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const part = text.slice(i, i + chunkSize);
    // emulate SSE-ish data lines: `data: {json}` or raw text chunk
    const line = `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`;
    chunks.push(encoder.encode(line));
  }

  // Add final [DONE]
  chunks.push(encoder.encode('data: [DONE]\n\n'));

  // Reader state
  let idx = 0;

  const reader = {
    async read() {
      if (idx >= chunks.length) return { done: true, value: undefined } as any;
      // simulate small delay to mimic streaming
      await new Promise((r) => setTimeout(r, delayMs));
      const value = chunks[idx++];
      return { done: false, value };
    }
  };

  return {
    ok: true,
    // minimal body with getReader()
    body: {
      getReader() {
        return reader;
      }
    }
  } as const;
}
