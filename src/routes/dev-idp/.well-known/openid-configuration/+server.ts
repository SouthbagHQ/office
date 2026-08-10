import { dev } from '$app/environment';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = ({ url }) => {
  if (!dev) return new Response('Not found', { status: 404 });
  const issuer = `${url.origin}/dev-idp`;
  return json({
    issuer,
    authorization_endpoint: `${url.origin}/dev-idp/authorize`,
    token_endpoint: `${url.origin}/dev-idp/token`,
    userinfo_endpoint: `${url.origin}/dev-idp/userinfo`,
    jwks_uri: `${url.origin}/dev-idp/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['EdDSA'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    scopes_supported: ['openid', 'profile', 'email']
  });
};
