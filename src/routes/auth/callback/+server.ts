import { env } from '$env/dynamic/private';
import { setSession, type OfficeUser } from '$lib/server/session';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';

type TokenResponse = { access_token?: string; token_type?: string; id_token?: string; error?: string };

export const GET: RequestHandler = async ({ cookies, url, fetch }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies.get('southbag_office_oauth_state');
  const verifier = cookies.get('southbag_office_oauth_verifier');
  cookies.delete('southbag_office_oauth_state', { path: '/' });
  cookies.delete('southbag_office_oauth_verifier', { path: '/' });

  if (!code || !state || state !== expectedState || !verifier) error(400, 'Identity paperwork did not match.');
  if (!env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET || !env.SESSION_SECRET) {
    error(503, 'Office SSO is missing its deployment secrets.');
  }

  const identityOrigin = env.IDENTITY_ORIGIN || 'https://identity.southbag.cc';
  const appOrigin = env.ORIGIN || url.origin;
  const credentials = btoa(`${env.OIDC_CLIENT_ID}:${env.OIDC_CLIENT_SECRET}`);
  const tokenResponse = await fetch(new URL('/api/auth/oauth2/token', identityOrigin), {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
      // Identity's current SvelteKit CSRF guard rejects standards-compliant
      // server POSTs without a same-origin Origin header.
      origin: identityOrigin
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${appOrigin}/auth/callback`,
      code_verifier: verifier
    })
  });
  const tokens = (await tokenResponse.json().catch(() => ({}))) as TokenResponse;
  if (!tokenResponse.ok || !tokens.access_token) error(502, tokens.error || 'Identity token exchange failed.');

  const metadataResponse = await fetch(new URL('/.well-known/openid-configuration', identityOrigin));
  const metadata = (await metadataResponse.json().catch(() => ({}))) as { userinfo_endpoint?: string };
  const userinfoEndpoint = metadata.userinfo_endpoint || new URL('/api/auth/oauth2/userinfo', identityOrigin).toString();
  const userResponse = await fetch(userinfoEndpoint, {
    headers: { authorization: `${tokens.token_type || 'Bearer'} ${tokens.access_token}` }
  });
  const profile = (await userResponse.json().catch(() => ({}))) as Partial<OfficeUser>;
  if (!userResponse.ok || !profile.sub || !profile.email) error(502, 'Identity returned an unidentified identity.');

  await setSession(
    cookies,
    {
      sub: profile.sub,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture
    },
    env.SESSION_SECRET,
    appOrigin.startsWith('https://')
  );

  redirect(302, '/?signed-in=eventually');
};
