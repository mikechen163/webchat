import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";
import { debug } from "$lib/utils/debug";

const ALLOWED_ORIGINS = import.meta.env.PUBLIC_ALLOWED_ORIGINS?.split(',') || [];

debug('Config', { ALLOWED_ORIGINS });

export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('Origin');
  debug('Request', {
    method: event.request.method,
    url: event.request.url,
    origin,
    headers: Object.fromEntries(event.request.headers.entries())
  });

  if (event.request.method !== 'OPTIONS') {
    const sessionId = event.cookies.get(auth.sessionCookieName);
    const session = sessionId ? await auth.validateSession(sessionId) : null;

    event.locals.auth = {
      session,
      user: session?.user ?? null,
    };

    const response = await resolve(event);

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      response.headers.append('Vary', 'Origin');
      
      const cspValue = `form-action 'self' ${ALLOWED_ORIGINS.join(' ')};`;
      response.headers.set('Content-Security-Policy', cspValue);
      
      debug('Response', {
        origin,
        csp: cspValue,
        headers: Object.fromEntries(response.headers.entries())
      });
    } else {
      debug('CORS Rejected', { origin, allowedOrigins: ALLOWED_ORIGINS });
    }

    return response;
  } else {
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      debug('OPTIONS Response', {
        origin,
        status: 403
      });
      return new Response(null, { status: 403 });
    }
    
    debug('OPTIONS Response', {
      origin,
      status: 204
    });
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