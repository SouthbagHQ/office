import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { decryptSouthbagFile, SouthbagFormatError } from '$lib/server/file-format';
import { InvalidContentLengthError, readLimitedRequestBody, RequestBodyTooLargeError } from '$lib/server/request';
import { capture, palantirOptions } from '$lib/server/palantir';

const MAX_IMPORT_BODY_BYTES = 2_600_000;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const palantir = palantirOptions(request, platform);
  const failed = (reason: string, extra: Record<string, unknown> = {}) =>
    capture('office_file_import_failed', locals.user?.sub, { reason, ...extra }, palantir);
  if (!locals.user) {
    void failed('unauthenticated');
    return json({ error: 'Identity required.' }, { status: 401 });
  }
  if (!env.SOUTHBAG_FILE_KEY) {
    void failed('unconfigured');
    return json({ error: 'File imports are not configured.' }, { status: 503 });
  }
  let bytes: Uint8Array;
  try {
    bytes = await readLimitedRequestBody(request, MAX_IMPORT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      void failed('too_large');
      return json({ error: 'The file is too large to import.' }, { status: 413 });
    }
    if (error instanceof InvalidContentLengthError) {
      void failed('invalid_length');
      return json({ error: 'The request size is invalid.' }, { status: 400 });
    }
    void failed('unreadable');
    return json({ error: 'The import request could not be read.' }, { status: 400 });
  }
  try {
    const file = await decryptSouthbagFile(bytes, env.SOUTHBAG_FILE_KEY);
    void capture('office_file_imported', locals.user.sub, { kind: file.kind, bytes: bytes.byteLength, title_length: file.title.length }, palantir);
    return json({ file });
  } catch (error) {
    const message = error instanceof SouthbagFormatError ? error.message : 'The file could not be imported.';
    void failed(error instanceof SouthbagFormatError ? 'format' : 'decrypt', { bytes: bytes.byteLength });
    return json({ error: message }, { status: 400 });
  }
};
