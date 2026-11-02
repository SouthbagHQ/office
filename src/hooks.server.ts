import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { decodeSession, getSessionCookie } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';
import { centralStatus, FROZEN_TEXT, STATUS_UNKNOWN_TEXT } from '$lib/server/identity';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionSecret = env.SESSION_SECRET || (dev ? 'southbag-office-development-session-secret-only' : '');
  event.locals.user = await decodeSession(getSessionCookie(event.cookies), sessionSecret);

  // The account-level freeze covers everything a signed-in user can do, reads included -
  // Office documents are private account data. While the central answer is UNKNOWN (Identity
  // configured but unreachable) EVERYTHING fails closed. /auth/* (logout) and the login page
  // stay reachable.
  if (event.locals.user && !event.url.pathname.startsWith('/auth/') && event.url.pathname !== '/login') {
    const central = await centralStatus(env, event.locals.user.sub);
    const api = event.url.pathname.startsWith('/api/');
    if (central === 'unknown')
      return new Response(STATUS_UNKNOWN_TEXT, { status: 503, headers: { 'content-type': api ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8' } });
    if (central !== 'off' && central.frozen)
      return new Response(FROZEN_TEXT, { status: 423, headers: { 'content-type': api ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8' } });
  }

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
