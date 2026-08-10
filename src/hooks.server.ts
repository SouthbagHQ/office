import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { decodeSession, getSessionCookie } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionSecret = env.SESSION_SECRET || (dev ? 'southbag-office-development-session-secret-only' : '');
  event.locals.user = await decodeSession(getSessionCookie(event.cookies), sessionSecret);
  const response = await resolve(event);

  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  if (event.locals.user || event.url.pathname.startsWith('/api/workspace')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
};
