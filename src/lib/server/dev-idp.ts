import { exportJWK, generateKeyPair, SignJWT } from 'jose';

export const DEV_CLIENT_ID = 'southbag-office-dev';
export const DEV_CLIENT_SECRET = 'southbag-office-dev-secret';
export const DEV_PASSWORD = 'southbag';

type DevUser = { sub: string; email: string; name: string };
type AuthorizationCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
  user: DevUser;
  expires: number;
};

const codes = new Map<string, AuthorizationCode>();
const tokens = new Map<string, DevUser>();
const keyPair = generateKeyPair('EdDSA');
const keyId = 'southbag-office-development-key';

function randomToken() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function issueAuthorizationCode(input: Omit<AuthorizationCode, 'expires'>) {
  const code = randomToken();
  codes.set(code, { ...input, expires: Date.now() + 5 * 60 * 1000 });
  return code;
}

export async function exchangeAuthorizationCode(code: string, verifier: string, issuer: string) {
  const record = codes.get(code);
  codes.delete(code);
  if (!record || record.expires < Date.now()) return null;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  if (base64Url(digest) !== record.codeChallenge) return null;

  const accessToken = randomToken();
  tokens.set(accessToken, record.user);
  const { privateKey } = await keyPair;
  const idToken = await new SignJWT({
    email: record.user.email,
    name: record.user.name,
    nonce: record.nonce
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: keyId })
    .setIssuer(issuer)
    .setAudience(record.clientId)
    .setSubject(record.user.sub)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);

  return { record, accessToken, idToken };
}

export function developmentUser(accessToken: string | undefined) {
  return accessToken ? tokens.get(accessToken) ?? null : null;
}

export async function developmentJwks() {
  const { publicKey } = await keyPair;
  return { keys: [{ ...(await exportJWK(publicKey)), alg: 'EdDSA', use: 'sig', kid: keyId }] };
}
