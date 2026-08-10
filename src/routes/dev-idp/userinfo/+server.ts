import { dev } from '$app/environment';
import { developmentUser } from '$lib/server/dev-idp';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ request }) => {
  if (!dev) return new Response('Not found', { status: 404 });
  const authorization = request.headers.get('authorization') ?? '';
  const user = developmentUser(authorization.startsWith('Bearer ') ? authorization.slice(7) : undefined);
  return user ? json(user) : json({ error: 'invalid_token' }, { status: 401 });
};
