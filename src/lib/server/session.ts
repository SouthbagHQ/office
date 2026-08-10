import type { Cookies } from '@sveltejs/kit';

export type OfficeUser = {
  sub: string;
  name: string;
  email: string;
  picture?: string;
};

const encoder = new TextEncoder();
const COOKIE_NAME = 'southbag_office_session';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function keyFor(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify'
  ]);
}

export async function encodeSession(user: OfficeUser, secret: string): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ user, expires: Date.now() + 8 * 60 * 60 * 1000 })));
  const signature = await crypto.subtle.sign('HMAC', await keyFor(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function decodeSession(value: string | undefined, secret: string): Promise<OfficeUser | null> {
  if (!value || !secret) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  try {
    const signatureBytes = fromBase64Url(signature);
    const signatureBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength
    ) as ArrayBuffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      await keyFor(secret),
      signatureBuffer,
      encoder.encode(payload)
    );
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      user: OfficeUser;
      expires: number;
    };
    return parsed.expires > Date.now() ? parsed.user : null;
  } catch {
    return null;
  }
}

export async function setSession(cookies: Cookies, user: OfficeUser, secret: string, secure: boolean) {
  cookies.set(COOKIE_NAME, await encodeSession(user, secret), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 8 * 60 * 60
  });
}

export function clearSession(cookies: Cookies) {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

export function getSessionCookie(cookies: Cookies) {
  return cookies.get(COOKIE_NAME);
}
