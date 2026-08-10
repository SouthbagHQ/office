import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { decryptSouthbagFile, SouthbagFormatError } from '$lib/server/file-format';
import { InvalidContentLengthError, readLimitedRequestBody, RequestBodyTooLargeError } from '$lib/server/request';

const MAX_IMPORT_BODY_BYTES = 2_600_000;

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'Identity required.' }, { status: 401 });
  if (!env.SOUTHBAG_FILE_KEY) return json({ error: 'File imports are not configured.' }, { status: 503 });
  let bytes: Uint8Array;
  try {
    bytes = await readLimitedRequestBody(request, MAX_IMPORT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: 'The file is too large to import.' }, { status: 413 });
    if (error instanceof InvalidContentLengthError) return json({ error: 'The request size is invalid.' }, { status: 400 });
    return json({ error: 'The import request could not be read.' }, { status: 400 });
  }
  try {
    const file = await decryptSouthbagFile(bytes, env.SOUTHBAG_FILE_KEY);
    return json({ file });
  } catch (error) {
    const message = error instanceof SouthbagFormatError ? error.message : 'The file could not be imported.';
    return json({ error: message }, { status: 400 });
  }
};
