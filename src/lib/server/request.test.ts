import { describe, expect, it } from 'vitest';
import { InvalidContentLengthError, readLimitedRequestBody, RequestBodyTooLargeError } from './request';

describe('limited request bodies', () => {
  it('reads a body when content-length is absent', async () => {
    const request = new Request('https://southbag.test', { method: 'POST', body: 'hello' });
    expect(request.headers.has('content-length')).toBe(false);
    await expect(readLimitedRequestBody(request, 5)).resolves.toEqual(new TextEncoder().encode('hello'));
  });

  it('stops an oversized body even without content-length', async () => {
    const request = new Request('https://southbag.test', { method: 'POST', body: 'too large' });
    await expect(readLimitedRequestBody(request, 4)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it('rejects invalid and oversized declared lengths before reading', async () => {
    const invalid = new Request('https://southbag.test', {
      method: 'POST',
      body: 'x',
      headers: { 'content-length': 'not-a-number' }
    });
    await expect(readLimitedRequestBody(invalid, 4)).rejects.toBeInstanceOf(InvalidContentLengthError);

    const oversized = new Request('https://southbag.test', {
      method: 'POST',
      body: 'x',
      headers: { 'content-length': '5' }
    });
    await expect(readLimitedRequestBody(oversized, 4)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
