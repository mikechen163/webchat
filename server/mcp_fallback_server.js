#!/usr/bin/env node
// Lightweight MCP fallback HTTP SSE server implemented in Node.
// Accepts POST JSON { messages: [...] } and streams `data: {...}\n\n` chunks echoing messages.

const http = require('http');

const HOST = '127.0.0.1';
const PORT = process.env.MCP_FALLBACK_PORT ? parseInt(process.env.MCP_FALLBACK_PORT, 10) : 33333;

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk.toString(); });
  req.on('end', () => {
    let messages = [];
    try {
      const payload = JSON.parse(body || '{}');
      messages = payload.messages || [];
    } catch (e) {
      messages = [];
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    (async () => {
      for (const m of messages) {
        const content = (m && typeof m === 'object') ? (m.content || '') : String(m);
        const data = JSON.stringify({ choices: [ { delta: { content: `echo: ${content}` } } ] });
        res.write(`data: ${data}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }
      res.write('data: [DONE]\n\n');
      // Keep connection open a short while to ensure client reads
      setTimeout(() => {
        try { res.end(); } catch (e) {}
      }, 50);
    })();
  });
});

server.listen(PORT, HOST, () => {
  console.error(`MCP fallback server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
