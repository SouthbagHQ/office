import { dev } from '$app/environment';
import { DEV_CLIENT_ID, DEV_CLIENT_SECRET, exchangeAuthorizationCode } from '$lib/server/dev-idp';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, url }) => {
  if (!dev) return new Response('Not found', { status: 404 });
  const authorization = request.headers.get('authorization') ?? '';
  const credentials = authorization.startsWith('Basic ') ? atob(authorization.slice(6)).split(':') : [];
  if (credentials[0] !== DEV_CLIENT_ID || credentials[1] !== DEV_CLIENT_SECRET) {
    return json({ error: 'invalid_client' }, { status: 401 });
  }
  const form = await request.formData();
  const code = form.get('code')?.toString() ?? '';
  const verifier = form.get('code_verifier')?.toString() ?? '';
  const result = await exchangeAuthorizationCode(code, verifier, `${url.origin}/dev-idp`);
  if (!result || form.get('redirect_uri') !== result.record.redirectUri) {
    return json({ error: 'invalid_grant' }, { status: 400 });
  }
  return json({
    access_token: result.accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: result.idToken,
    scope: 'openid profile email'
  });
};
