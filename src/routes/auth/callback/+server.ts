import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { setSession, type OfficeUser } from '$lib/server/session';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { oauthClient } from '$lib/server/oauth-client';

type TokenResponse = { access_token?: string; token_type?: string; id_token?: string; error?: string };

export const GET: RequestHandler = async ({ cookies, url, fetch, platform }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookies.get('southbag_office_oauth_state');
  const verifier = cookies.get('southbag_office_oauth_verifier');
  const nonce = cookies.get('southbag_office_oauth_nonce');
  const provider = cookies.get('southbag_office_oauth_provider');
  cookies.delete('southbag_office_oauth_state', { path: '/' });
  cookies.delete('southbag_office_oauth_verifier', { path: '/' });
  cookies.delete('southbag_office_oauth_nonce', { path: '/' });
  cookies.delete('southbag_office_oauth_provider', { path: '/' });

  if (!code || !state || state !== expectedState || !verifier || !nonce) error(400, 'Identity paperwork did not match.');
  const useDevelopmentProvider = dev && provider === 'development' && env.USE_DEV_IDP === 'true';
  const sessionSecret = env.SESSION_SECRET || (useDevelopmentProvider ? 'southbag-office-development-session-secret-only' : '');
  if (!sessionSecret || (!useDevelopmentProvider && !platform?.env.DB)) {
    error(503, 'Office SSO is missing its deployment secrets.');
  }

  const identityOrigin = useDevelopmentProvider ? url.origin : env.IDENTITY_ORIGIN || 'https://identity.southbag.cc';
  const issuer = useDevelopmentProvider ? `${url.origin}/dev-idp` : identityOrigin;
  const appOrigin = useDevelopmentProvider ? url.origin : env.ORIGIN || url.origin;
  const redirectUri = `${appOrigin}/auth/callback`;
  const { clientId, clientSecret } = useDevelopmentProvider
    ? { clientId: 'southbag-office-dev', clientSecret: 'southbag-office-dev-secret' }
    : await oauthClient(platform!.env.DB, fetch, identityOrigin, redirectUri, appOrigin);
  const tokenEndpoint = new URL(useDevelopmentProvider ? '/dev-idp/token' : '/api/auth/oauth2/token', identityOrigin);
  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      ...(clientSecret ? { authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` } : {}),
      'content-type': 'application/x-www-form-urlencoded',
      // Identity's current SvelteKit CSRF guard rejects standards-compliant
      // server POSTs without a same-origin Origin header.
      origin: tokenEndpoint.origin
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  const tokens = (await tokenResponse.json().catch(() => ({}))) as TokenResponse;
  if (!tokenResponse.ok || !tokens.access_token || !tokens.id_token) error(502, tokens.error || 'Identity token exchange failed.');

  const metadataResponse = await fetch(
    new URL(useDevelopmentProvider ? '/dev-idp/.well-known/openid-configuration' : '/.well-known/openid-configuration', identityOrigin)
  );
  const metadata = (await metadataResponse.json().catch(() => ({}))) as {
    issuer?: string;
    jwks_uri?: string;
    userinfo_endpoint?: string;
  };
  if (!metadataResponse.ok || !metadata.jwks_uri || metadata.issuer !== issuer) {
    error(502, 'Identity discovery disagreed with itself.');
  }
  try {
    const verified = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(metadata.jwks_uri)), {
      issuer,
      audience: clientId
    });
    if (verified.payload.nonce !== nonce) throw new Error('nonce mismatch');
  } catch {
    error(401, 'Identity token signature or nonce was not acceptable.');
  }
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
    sessionSecret,
    appOrigin.startsWith('https://')
  );

  redirect(302, '/?signed-in=eventually');
};
