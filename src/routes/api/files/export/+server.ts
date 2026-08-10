import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { southbagFilename } from '$lib/file-format';
import { encryptSouthbagFile, SouthbagFormatError, southbagContentType } from '$lib/server/file-format';
import { InvalidContentLengthError, readLimitedRequestBody, RequestBodyTooLargeError } from '$lib/server/request';
import { parseWorkspace } from '$lib/server/workspace';

const MAX_EXPORT_BODY_BYTES = 2_100_000;

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'Identity required.' }, { status: 401 });
  if (!env.SOUTHBAG_FILE_KEY) return json({ error: 'File exports are not configured.' }, { status: 503 });
  let requestBytes: Uint8Array;
  try {
    requestBytes = await readLimitedRequestBody(request, MAX_EXPORT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: 'The file is too large to export.' }, { status: 413 });
    if (error instanceof InvalidContentLengthError) return json({ error: 'The request size is invalid.' }, { status: 400 });
    return json({ error: 'The export request could not be read.' }, { status: 400 });
  }
  const body = (() => {
    try {
      return JSON.parse(new TextDecoder().decode(requestBytes)) as { file?: unknown };
    } catch {
      return null;
    }
  })();
  const workspace = parseWorkspace({ files: body?.file ? [body.file] : [] });
  const file = workspace?.files[0];
  if (!file) return json({ error: 'A valid Southbag Office file is required.' }, { status: 400 });

  try {
    const encrypted = await encryptSouthbagFile(file, env.SOUTHBAG_FILE_KEY);
    const filename = southbagFilename(file.title, file.kind);
    return new Response(Uint8Array.from(encrypted).buffer, {
      headers: {
        'content-type': southbagContentType(file.kind),
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    const message = error instanceof SouthbagFormatError ? error.message : 'The file could not be exported.';
    return json({ error: message }, { status: 500 });
  }
};
