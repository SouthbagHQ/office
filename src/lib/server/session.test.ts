import { describe, expect, it } from 'vitest';
import { decodeSession, encodeSession } from './session';

const user = { sub: 'user-1', name: 'Kevin Adjacent', email: 'kevin@example.test' };
const secret = 'this-is-a-long-test-secret-with-enough-entropy';

describe('office session cookie', () => {
  it('round-trips a signed identity', async () => {
    expect(await decodeSession(await encodeSession(user, secret), secret)).toEqual(user);
  });

  it('rejects tampering and the wrong secret', async () => {
    const cookie = await encodeSession(user, secret);
    const [payload, signature] = cookie.split('.');
    const changedSignature = `${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
    expect(await decodeSession(`${payload}.${changedSignature}`, secret)).toBeNull();
    expect(await decodeSession(cookie, 'a-different-secret')).toBeNull();
  });
});
