import { describe, expect, it } from 'vitest';
import { createFile } from '../workspace';
import { decryptSouthbagFile, encryptSouthbagFile, SouthbagFormatError } from './file-format';

const key = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => index + 1)));
const otherKey = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, index) => 255 - index)));

describe('Southbag encrypted file format', () => {
  it.each(['doc', 'slides', 'sheet'] as const)('round trips a %s through an encrypted ZIP', async (kind) => {
    const file = createFile(kind, 'Format Tester');
    const encrypted = await encryptSouthbagFile(file, key);

    expect(new TextDecoder().decode(encrypted.subarray(0, 8))).toBe('SOUTHBAG');
    expect(new TextDecoder().decode(encrypted)).not.toContain(file.title);
    await expect(decryptSouthbagFile(encrypted, key)).resolves.toEqual(file);
  });

  it('rejects tampering and keys from another server', async () => {
    const encrypted = await encryptSouthbagFile(createFile('doc'), key);
    encrypted[encrypted.length - 1] ^= 1;
    await expect(decryptSouthbagFile(encrypted, key)).rejects.toBeInstanceOf(SouthbagFormatError);

    const clean = await encryptSouthbagFile(createFile('doc'), key);
    await expect(decryptSouthbagFile(clean, otherKey)).rejects.toThrow(/could not be opened/);
  });

  it('requires a 256-bit base64 key', async () => {
    await expect(encryptSouthbagFile(createFile('doc'), btoa('short'))).rejects.toThrow(/exactly 32/);
  });
});
