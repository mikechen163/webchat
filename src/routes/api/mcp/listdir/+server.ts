import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

const DEFAULT_MCP_URL = process.env.LOCAL_MCP_URL || 'http://127.0.0.1:33333';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const path = body?.path || '.';

  try {
    const res = await fetch(`${DEFAULT_MCP_URL}/tools/list_dir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });

    const data = await res.json().catch(() => null);
    if (!data) return json({ ok: false, error: 'invalid tool response' }, { status: 502 });
    if (!data.ok) return json({ ok: false, error: 'tool returned error' }, { status: 500 });

    const items: string[] = data.items || [];
    const text = `Directory listing for ${path}:\n` + items.map(i => `- ${i}`).join('\n');
    return json({ ok: true, text, items });
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 500 });
  }
};
