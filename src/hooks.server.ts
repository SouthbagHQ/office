import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { decodeSession, getSessionCookie } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionSecret = env.SESSION_SECRET || (dev ? 'southbag-office-development-session-secret-only' : '');
  event.locals.user = await decodeSession(getSessionCookie(event.cookies), sessionSecret);
  return resolve(event);
};
