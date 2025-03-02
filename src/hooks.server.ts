import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";
import { debug } from "$lib/utils/debug";
import { env } from "$env/dynamic/public";

const ALLOWED_ORIGINS = env.PUBLIC_ALLOWED_ORIGINS?.split(',') || [];
const APP_URL = env.PUBLIC_APP_URL;

debug('Config', { 
  ALLOWED_ORIGINS,
  rawEnv: env.PUBLIC_ALLOWED_ORIGINS 
});

export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('Origin');
  const proto = event.request.headers.get('x-forwarded-proto');
  const host = event.request.headers.get('host');
  const cfVisitor = event.request.headers.get('cf-visitor');
  const requestUrl = new URL(event.request.url);

  debug('URL Info', {
    proto,
    host,
    cfVisitor,
    url: event.request.url
  });

  // Handle HTTP requests
  if (proto === 'http' || (cfVisitor && cfVisitor.includes('"scheme":"http"'))) {
    const secureUrl = new URL(event.request.url);
    secureUrl.protocol = 'https:';
    secureUrl.host = host || secureUrl.host;
    
    debug('HTTPS Redirect', {
      from: event.request.url,
      to: secureUrl.toString()
    });
    
    return new Response(null, {
      status: 301,
      headers: {
        'Location': secureUrl.toString(),
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      }
    });
  }

  if (event.request.method !== 'OPTIONS') {
    const sessionId = event.cookies.get(auth.sessionCookieName);
    const session = sessionId ? await auth.validateSession(sessionId) : null;

    event.locals.auth = {
      session,
      user: session?.user ?? null,
    };

    const response = await resolve(event);

    // Set security headers for all responses
    const securityHeaders = {
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: blob: https:;
        font-src 'self' data:;
        form-action 'self' ${ALLOWED_ORIGINS.join(' ')};
        frame-ancestors 'none';
        base-uri 'self';
        connect-src 'self' ${ALLOWED_ORIGINS.join(' ')} https:;
      `.trim().replace(/\s+/g, ' '),
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Only apply CORS headers when Origin is present
    if (origin) {
      if (ALLOWED_ORIGINS.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        response.headers.append('Vary', 'Origin');
        debug('CORS Allowed', { origin });
      } else {
        debug('CORS Rejected', { origin, allowedOrigins: ALLOWED_ORIGINS });
      }
    } else {
      debug('Same-origin request', { url: event.request.url });
    }

    return response;
  } else {
    // Only check CORS for OPTIONS requests with Origin header
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      debug('OPTIONS Rejected', { origin });
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