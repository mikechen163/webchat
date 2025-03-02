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

    // 获取请求的来源
    const origin = event.request.headers.get('Origin');
    
    // 如果存在 Origin 头，将其设置为允许的源
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      // 添加 Vary 头以确保浏览器正确缓存响应
      response.headers.append('Vary', 'Origin');
    }

    return response;
  } else {
    // OPTIONS 预检请求处理
    const origin = event.request.headers.get('Origin');
    
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin || '',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      }
    });
  }
};