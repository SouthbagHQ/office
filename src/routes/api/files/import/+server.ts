import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { decryptSouthbagFile, SouthbagFormatError } from '$lib/server/file-format';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) return json({ error: 'Identity required.' }, { status: 401 });
  if (!env.SOUTHBAG_FILE_KEY) return json({ error: 'File imports are not configured.' }, { status: 503 });
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 2_600_000) return json({ error: 'The file is too large to import.' }, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  try {
    const file = await decryptSouthbagFile(bytes, env.SOUTHBAG_FILE_KEY);
    return json({ file });
  } catch (error) {
    const message = error instanceof SouthbagFormatError ? error.message : 'The file could not be imported.';
    return json({ error: message }, { status: 400 });
  }
};
