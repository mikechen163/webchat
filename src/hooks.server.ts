import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // 手动处理请求
  const sessionId = event.cookies.get(auth.sessionCookieName);
  const session = sessionId ? await auth.validateSession(sessionId) : null;

  event.locals.auth = {
    session,
    user: session?.user ?? null,
  };

  return await resolve(event);
};