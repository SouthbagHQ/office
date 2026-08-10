import { json, type RequestHandler } from '@sveltejs/kit';
import { parseWorkspace, rowToWorkspace, workspaceOwner } from '$lib/server/workspace';

type WorkspaceRow = { data: string; revision: number; updated_at: string };

function database(platform: App.Platform | undefined): D1Database | null {
  return platform?.env?.DB ?? null;
}

export const GET: RequestHandler = async ({ platform, locals, cookies, url }) => {
  const db = database(platform);
  if (!db) return json({ error: 'Cloud filing cabinet unavailable.' }, { status: 503 });
  const owner = workspaceOwner(locals.user, cookies, url.protocol === 'https:');
  const row = await db
    .prepare('SELECT data, revision, updated_at FROM workspaces WHERE owner_key = ?')
    .bind(owner)
    .first<WorkspaceRow>();

  if (!row) return json({ workspace: null, revision: 0, updatedAt: '' });
  const stored = rowToWorkspace(row);
  return stored ? json(stored) : json({ error: 'Cloud workspace is unreadable.' }, { status: 500 });
};

export const PUT: RequestHandler = async ({ request, platform, locals, cookies, url }) => {
  const db = database(platform);
  if (!db) return json({ error: 'Cloud filing cabinet unavailable.' }, { status: 503 });
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 2_100_000) return json({ error: 'Workspace is too furnished.' }, { status: 413 });
  const body = (await request.json().catch(() => null)) as {
    workspace?: unknown;
    expectedRevision?: unknown;
  } | null;
  const workspace = parseWorkspace(body?.workspace);
  if (!workspace) return json({ error: 'Workspace refused to resemble a workspace.' }, { status: 400 });

  const owner = workspaceOwner(locals.user, cookies, url.protocol === 'https:');
  const existing = await db
    .prepare('SELECT data, revision, updated_at FROM workspaces WHERE owner_key = ?')
    .bind(owner)
    .first<WorkspaceRow>();
  const expectedRevision = typeof body?.expectedRevision === 'number' ? body.expectedRevision : 0;

  if (existing && existing.revision !== expectedRevision) {
    const stored = rowToWorkspace(existing);
    return json({ error: 'Someone saved in front of you.', ...stored }, { status: 409 });
  }
  if (!existing && expectedRevision !== 0) {
    return json({ error: 'The expected cloud workspace has moved.' }, { status: 409 });
  }

  const updatedAt = new Date().toISOString();
  const data = JSON.stringify(workspace);
  if (existing) {
    const result = await db
      .prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_key = ? AND revision = ?')
      .bind(data, updatedAt, owner, expectedRevision)
      .run();
    if (result.meta.changes !== 1) return json({ error: 'Cloud save collided. Please try again.' }, { status: 409 });
  } else {
    await db
      .prepare('INSERT INTO workspaces (owner_key, data, revision, updated_at) VALUES (?, ?, 1, ?)')
      .bind(owner, data, updatedAt)
      .run();
  }

  return json({ workspace, revision: expectedRevision + 1, updatedAt });
};
