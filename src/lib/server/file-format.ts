import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { southbagMimeType } from '../file-format';
import { parseWorkspace } from './workspace';
import type { Kind, OfficeFile } from '../workspace';

const MAGIC = strToU8('SOUTHBAG');
const VERSION = 1;
const IV_BYTES = 12;
const HEADER_BYTES = MAGIC.length + 2 + IV_BYTES;
const MAX_PACKAGE_BYTES = 2_500_000;
const kindCode: Record<Kind, number> = { doc: 1, slides: 2, sheet: 3 };
const codeKind: Record<number, Kind> = { 1: 'doc', 2: 'slides', 3: 'sheet' };

export class SouthbagFormatError extends Error {}

function decodeKey(encodedKey: string): Uint8Array {
  const normalized = encodedKey.trim().replace(/-/g, '+').replace(/_/g, '/');
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new SouthbagFormatError('SOUTHBAG_FILE_KEY must be base64 encoded.');
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.length !== 32) {
    throw new SouthbagFormatError('SOUTHBAG_FILE_KEY must contain exactly 32 random bytes.');
  }
  return bytes;
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function cryptoKey(encodedKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', ownedBuffer(decodeKey(encodedKey)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function validatedFile(value: unknown): OfficeFile {
  const workspace = parseWorkspace({ files: [value] });
  if (!workspace) throw new SouthbagFormatError('The package does not contain a valid Southbag Office file.');
  return workspace.files[0];
}

export async function encryptSouthbagFile(fileValue: unknown, encodedKey: string): Promise<Uint8Array> {
  const file = validatedFile(fileValue);
  const manifest = {
    format: 'Southbag Office Encrypted Package',
    version: VERSION,
    kind: file.kind,
    content: 'content.json'
  };
  const archive = zipSync(
    {
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'content.json': strToU8(JSON.stringify(file))
    },
    { level: 6 }
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  header[MAGIC.length] = VERSION;
  header[MAGIC.length + 1] = kindCode[file.kind];
  header.set(iv, MAGIC.length + 2);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ownedBuffer(iv), additionalData: ownedBuffer(header.subarray(0, MAGIC.length + 2)), tagLength: 128 },
    await cryptoKey(encodedKey),
    ownedBuffer(archive)
  );
  const output = new Uint8Array(header.length + encrypted.byteLength);
  output.set(header, 0);
  output.set(new Uint8Array(encrypted), header.length);
  return output;
}

export async function decryptSouthbagFile(packageBytes: Uint8Array, encodedKey: string): Promise<OfficeFile> {
  if (packageBytes.length < HEADER_BYTES + 16 || packageBytes.length > MAX_PACKAGE_BYTES) {
    throw new SouthbagFormatError('The package has an invalid size.');
  }
  if (!MAGIC.every((byte, index) => packageBytes[index] === byte)) {
    throw new SouthbagFormatError('This is not a Southbag Office package.');
  }
  const version = packageBytes[MAGIC.length];
  const expectedKind = codeKind[packageBytes[MAGIC.length + 1]];
  if (version !== VERSION || !expectedKind) throw new SouthbagFormatError('This package version is not supported.');
  const iv = packageBytes.subarray(MAGIC.length + 2, HEADER_BYTES);
  let archiveBytes: ArrayBuffer;
  try {
    archiveBytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ownedBuffer(iv), additionalData: ownedBuffer(packageBytes.subarray(0, MAGIC.length + 2)), tagLength: 128 },
      await cryptoKey(encodedKey),
      ownedBuffer(packageBytes.subarray(HEADER_BYTES))
    );
  } catch {
    throw new SouthbagFormatError('The package could not be opened by this Southbag server.');
  }

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(new Uint8Array(archiveBytes));
  } catch {
    throw new SouthbagFormatError('The package is not readable.');
  }
  if (!archive['manifest.json'] || !archive['content.json']) {
    throw new SouthbagFormatError('The package is missing required files.');
  }
  try {
    const manifest = JSON.parse(strFromU8(archive['manifest.json'])) as { version?: unknown; kind?: unknown; content?: unknown };
    if (manifest.version !== VERSION || manifest.kind !== expectedKind || manifest.content !== 'content.json') {
      throw new Error('manifest mismatch');
    }
    const file = validatedFile(JSON.parse(strFromU8(archive['content.json'])));
    if (file.kind !== expectedKind) throw new Error('kind mismatch');
    return file;
  } catch (error) {
    if (error instanceof SouthbagFormatError) throw error;
    throw new SouthbagFormatError('The package manifest or content is invalid.');
  }
}

export function southbagContentType(kind: Kind): string {
  return southbagMimeType(kind);
}
