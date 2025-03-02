import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

const ALLOWED_ORIGINS = import.meta.env.PUBLIC_ALLOWED_ORIGINS?.split(',') || [];

export const handle: Handle = async ({ event, resolve }) => {
  if (event.request.method !== 'OPTIONS') {
    const sessionId = event.cookies.get(auth.sessionCookieName);
    const session = sessionId ? await auth.validateSession(sessionId) : null;

    event.locals.auth = {
      session,
      user: session?.user ?? null,
    };

    const response = await resolve(event);

    const origin = event.request.headers.get('Origin');
    
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      response.headers.append('Vary', 'Origin');
    }

    return response;
  } else {
    const origin = event.request.headers.get('Origin');
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 403 });
    }
    
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      }
    });
  }
};