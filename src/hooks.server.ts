import { env } from '$env/dynamic/private';
import { decodeSession, getSessionCookie } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await decodeSession(getSessionCookie(event.cookies), env.SESSION_SECRET ?? '');
  return resolve(event);
};
