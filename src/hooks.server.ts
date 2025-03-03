import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";
import { PUBLIC_EXTERNAL_DOMAIN } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  // Handle preflight OPTIONS requests
  if (event.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': PUBLIC_EXTERNAL_DOMAIN,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '3600'
      }
    });
  }

  // 手动处理请求
  const sessionId = event.cookies.get(auth.sessionCookieName);
  const session = sessionId ? await auth.validateSession(sessionId) : null;

  event.locals.auth = {
    session,
    user: session?.user ?? null,
  };

  // Process the request
  const response = await resolve(event);
  
  // Add CORS headers to the response
  response.headers.set('Access-Control-Allow-Origin', PUBLIC_EXTERNAL_DOMAIN);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
};