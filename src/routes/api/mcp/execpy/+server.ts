import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

const DEFAULT_MCP_URL = process.env.LOCAL_MCP_URL || 'http://127.0.0.1:33333';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const code = body?.code || '';
  const timeout = Number(body?.timeout || 5);
  const cwd = body?.cwd || undefined;

  if (!code) return json({ ok: false, error: 'no code provided' }, { status: 400 });

  try {
    const res = await fetch(`${DEFAULT_MCP_URL}/tools/execute_python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, timeout, cwd })
    });

    const data = await res.json().catch(() => null);
    if (!data) return json({ ok: false, error: 'invalid tool response' }, { status: 502 });

    return json(data);
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
};
