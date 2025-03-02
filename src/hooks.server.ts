import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  // 处理 CORS
  if (event.request.method !== 'OPTIONS') {
    // 实际请求处理
    const sessionId = event.cookies.get(auth.sessionCookieName);
    const session = sessionId ? await auth.validateSession(sessionId) : null;

    event.locals.auth = {
      session,
      user: session?.user ?? null,
    };

    const response = await resolve(event);

    // const allowedOrigins = ['https://your_domain.com', 'http://localhost:3000'];

    const allowedOrigins = import.meta.env.VITE_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

const origin = event.request.headers.get('Origin');
if (origin && allowedOrigins.includes(origin)) {
  response.headers.append('Access-Control-Allow-Origin', origin);
}
    
    // 添加 CORS 响应头
    //response.headers.append('Access-Control-Allow-Origin', '*');  // 或指定域名
    response.headers.append('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.append('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.append('Access-Control-Allow-Credentials', 'true');

    return response;
  } else {
    // OPTIONS 预检请求处理
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',  // 或指定域名
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      }
    });
  }
};