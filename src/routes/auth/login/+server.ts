import { env } from '$env/dynamic/private';
import { redirect, type RequestHandler } from '@sveltejs/kit';

const encoder = new TextEncoder();

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  if (!env.OIDC_CLIENT_ID) {
    redirect(302, '/?auth=unconfigured');
  }

  const identityOrigin = env.IDENTITY_ORIGIN || 'https://identity.southbag.cc';
  const appOrigin = env.ORIGIN || url.origin;
  const state = randomToken();
  const verifier = randomToken();
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
  const secure = appOrigin.startsWith('https://');
  const cookieOptions = { path: '/', httpOnly: true, secure, sameSite: 'lax' as const, maxAge: 600 };

  cookies.set('southbag_office_oauth_state', state, cookieOptions);
  cookies.set('southbag_office_oauth_verifier', verifier, cookieOptions);

  const authorize = new URL('/api/auth/oauth2/authorize', identityOrigin);
  authorize.search = new URLSearchParams({
    client_id: env.OIDC_CLIENT_ID,
    redirect_uri: `${appOrigin}/auth/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();

  redirect(302, authorize.toString());
};
