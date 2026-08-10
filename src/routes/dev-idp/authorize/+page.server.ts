import { dev } from '$app/environment';
import { DEV_CLIENT_ID, DEV_PASSWORD, issueAuthorizationCode } from '$lib/server/dev-idp';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function oauthParameters(url: URL) {
  return {
    clientId: url.searchParams.get('client_id') ?? '',
    redirectUri: url.searchParams.get('redirect_uri') ?? '',
    state: url.searchParams.get('state') ?? '',
    nonce: url.searchParams.get('nonce') ?? '',
    codeChallenge: url.searchParams.get('code_challenge') ?? '',
    codeChallengeMethod: url.searchParams.get('code_challenge_method') ?? ''
  };
}

function validRequest(parameters: ReturnType<typeof oauthParameters>, origin: string) {
  return (
    parameters.clientId === DEV_CLIENT_ID &&
    parameters.redirectUri === `${origin}/auth/callback` &&
    Boolean(parameters.state && parameters.nonce && parameters.codeChallenge) &&
    parameters.codeChallengeMethod === 'S256'
  );
}

export const load: PageServerLoad = ({ url }) => {
  if (!dev) error(404, 'Development identity does not work at work.');
  const parameters = oauthParameters(url);
  if (!validRequest(parameters, url.origin)) error(400, 'OAuth request has incorrect paperwork.');
  return { oauthQuery: url.searchParams.toString() };
};

export const actions: Actions = {
  default: async ({ request, url }) => {
    if (!dev) error(404, 'Development identity does not work at work.');
    const form = await request.formData();
    const oauthQuery = form.get('oauthQuery')?.toString() ?? '';
    const oauthUrl = new URL(`/dev-idp/authorize?${oauthQuery}`, url.origin);
    const parameters = oauthParameters(oauthUrl);
    if (!validRequest(parameters, url.origin)) {
      return fail(400, { message: 'OAuth request expired incorrectly.', email: '', name: '' });
    }

    const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
    const name = form.get('name')?.toString().trim() || 'Development Employee';
    const password = form.get('password')?.toString() ?? '';
    if (!email.includes('@') || password !== DEV_PASSWORD) {
      return fail(401, { message: 'The development identity disagrees with those credentials.', email, name });
    }

    const code = issueAuthorizationCode({
      clientId: parameters.clientId,
      redirectUri: parameters.redirectUri,
      codeChallenge: parameters.codeChallenge,
      nonce: parameters.nonce,
      user: { sub: `dev-${email}`, email, name }
    });
    const callback = new URL(parameters.redirectUri);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', parameters.state);
    redirect(303, callback.toString());
  }
};
