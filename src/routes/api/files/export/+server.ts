import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { southbagFilename } from '$lib/file-format';
import { encryptSouthbagFile, SouthbagFormatError, southbagContentType } from '$lib/server/file-format';
import { parseWorkspace } from '$lib/server/workspace';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'Identity required.' }, { status: 401 });
  if (!env.SOUTHBAG_FILE_KEY) return json({ error: 'Encrypted file exports are not configured.' }, { status: 503 });
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 2_100_000) return json({ error: 'The file is too large to export.' }, { status: 413 });
  const body = (await request.json().catch(() => null)) as { file?: unknown } | null;
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
    const message = error instanceof SouthbagFormatError ? error.message : 'The file could not be encrypted.';
    return json({ error: message }, { status: 500 });
  }
};
