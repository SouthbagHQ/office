import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { redirect, type RequestHandler } from '@sveltejs/kit';
import { oauthClient } from '$lib/server/oauth-client';

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

export const GET: RequestHandler = async ({ cookies, url, fetch, platform }) => {
  const useDevelopmentProvider = dev && env.USE_DEV_IDP === 'true';
  const sessionSecret = env.SESSION_SECRET || (useDevelopmentProvider ? 'southbag-office-development-session-secret-only' : '');
  if (!sessionSecret || (!useDevelopmentProvider && !platform?.env.DB)) redirect(302, '/login?error=unconfigured');

  const identityOrigin = useDevelopmentProvider ? url.origin : env.IDENTITY_ORIGIN || 'https://identity.southbag.cc';
  const appOrigin = useDevelopmentProvider ? url.origin : env.ORIGIN || url.origin;
  const redirectUri = `${appOrigin}/auth/callback`;
  const { clientId } = useDevelopmentProvider
    ? { clientId: 'southbag-office-dev' }
    : await oauthClient(platform!.env.DB, fetch, identityOrigin, redirectUri, appOrigin);
  const state = randomToken();
  const verifier = randomToken();
  const nonce = randomToken();
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
  const secure = appOrigin.startsWith('https://');
  const cookieOptions = { path: '/', httpOnly: true, secure, sameSite: 'lax' as const, maxAge: 600 };

  cookies.set('southbag_office_oauth_state', state, cookieOptions);
  cookies.set('southbag_office_oauth_verifier', verifier, cookieOptions);
  cookies.set('southbag_office_oauth_nonce', nonce, cookieOptions);
  cookies.set('southbag_office_oauth_provider', useDevelopmentProvider ? 'development' : 'southbag', cookieOptions);

  const authorize = new URL(useDevelopmentProvider ? '/dev-idp/authorize' : '/api/auth/oauth2/authorize', identityOrigin);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString();

  redirect(302, authorize.toString());
};
