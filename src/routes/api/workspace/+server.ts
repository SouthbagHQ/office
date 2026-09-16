import { json, type RequestHandler } from '@sveltejs/kit';
import { parseWorkspace, rowToWorkspace, workspaceOwner } from '$lib/server/workspace';
import { capture, palantirOptions } from '$lib/server/palantir';
import type { OfficeFile, Workspace } from '$lib/workspace';

type WorkspaceRow = { data: string; revision: number; updated_at: string };

function database(platform: App.Platform | undefined): D1Database | null {
  return platform?.env?.DB ?? null;
}

function countByKind(files: OfficeFile[]) {
  return {
    files: files.length,
    docs: files.filter((file) => file.kind === 'doc').length,
    slides: files.filter((file) => file.kind === 'slides').length,
    sheets: files.filter((file) => file.kind === 'sheet').length
  };
}

/** Files that appeared or disappeared between the stored and incoming workspace. */
function workspaceDiff(previous: Workspace | null, next: Workspace) {
  const before = new Map((previous?.files ?? []).map((file) => [file.id, file]));
  const after = new Map(next.files.map((file) => [file.id, file]));
  const previouslyDeleted = new Set(previous?.deletedIds ?? []);
  return {
    created: next.files.filter((file) => !before.has(file.id)),
    deleted: [...before.values()].filter((file) => !after.has(file.id)),
    tombstoned: (next.deletedIds ?? []).filter((id) => !previouslyDeleted.has(id) && !before.has(id)).length
  };
}

export const GET: RequestHandler = async ({ platform, locals, request }) => {
  const palantir = palantirOptions(request, platform);
  if (!locals.user) {
    void capture('office_workspace_rejected', undefined, { operation: 'load', reason: 'unauthenticated' }, palantir);
    return json({ error: 'Identity required.' }, { status: 401 });
  }
  const db = database(platform);
  if (!db) {
    void capture('office_workspace_rejected', locals.user.sub, { operation: 'load', reason: 'no_database' }, palantir);
    return json({ error: 'The Southbag Cloud is unavailable.' }, { status: 503 });
  }
  const owner = workspaceOwner(locals.user);
  const row = await db
    .prepare('SELECT data, revision, updated_at FROM workspaces WHERE owner_key = ?')
    .bind(owner)
    .first<WorkspaceRow>();

  if (!row) {
    void capture('office_workspace_loaded', locals.user.sub, { empty: true, revision: 0 }, palantir);
    return json({ workspace: null, revision: 0, updatedAt: '' });
  }
  const stored = rowToWorkspace(row);
  if (!stored) {
    void capture('office_workspace_rejected', locals.user.sub, { operation: 'load', reason: 'unreadable' }, palantir);
    return json({ error: 'Your workspace could not be read.' }, { status: 500 });
  }
  void capture('office_workspace_loaded', locals.user.sub, { empty: false, revision: stored.revision, ...countByKind(stored.workspace.files) }, palantir);
  return json(stored);
};

export const PUT: RequestHandler = async ({ request, platform, locals }) => {
  const palantir = palantirOptions(request, platform);
  const rejected = (reason: string, extra: Record<string, unknown> = {}) =>
    capture('office_workspace_rejected', locals.user?.sub, { operation: 'save', reason, ...extra }, palantir);
  if (!locals.user) {
    void rejected('unauthenticated');
    return json({ error: 'Identity required.' }, { status: 401 });
  }
  const db = database(platform);
  if (!db) {
    void rejected('no_database');
    return json({ error: 'The Southbag Cloud is unavailable.' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 2_100_000) {
    void rejected('too_large', { bytes: contentLength });
    return json({ error: 'Your workspace is too large.' }, { status: 413 });
  }
  const body = (await request.json().catch(() => null)) as {
    workspace?: unknown;
    expectedRevision?: unknown;
  } | null;
  const workspace = parseWorkspace(body?.workspace);
  if (!workspace) {
    void rejected('unparseable');
    return json({ error: 'Your workspace could not be read.' }, { status: 400 });
  }

  const owner = workspaceOwner(locals.user);
  const existing = await db
    .prepare('SELECT data, revision, updated_at FROM workspaces WHERE owner_key = ?')
    .bind(owner)
    .first<WorkspaceRow>();
  const expectedRevision = typeof body?.expectedRevision === 'number' ? body.expectedRevision : 0;

  if (existing && existing.revision !== expectedRevision) {
    const stored = rowToWorkspace(existing);
    void capture('office_workspace_conflict', locals.user.sub, { expectedRevision, storedRevision: existing.revision, reason: 'revision_mismatch' }, palantir);
    return json({ error: 'Someone else saved first. Please try again.', ...stored }, { status: 409 });
  }
  if (!existing && expectedRevision !== 0) {
    void capture('office_workspace_conflict', locals.user.sub, { expectedRevision, storedRevision: 0, reason: 'workspace_moved' }, palantir);
    return json({ error: 'Your workspace has moved.' }, { status: 409 });
  }

  const updatedAt = new Date().toISOString();
  const data = JSON.stringify(workspace);
  if (existing) {
    const result = await db
      .prepare('UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE owner_key = ? AND revision = ?')
      .bind(data, updatedAt, owner, expectedRevision)
      .run();
    if (result.meta.changes !== 1) {
      void capture('office_workspace_conflict', locals.user.sub, { expectedRevision, reason: 'write_collision' }, palantir);
      return json({ error: 'Cloud save collided. Please try again.' }, { status: 409 });
    }
  } else {
    await db
      .prepare('INSERT INTO workspaces (owner_key, data, revision, updated_at) VALUES (?, ?, 1, ?)')
      .bind(owner, data, updatedAt)
      .run();
    void capture('office_workspace_created', locals.user.sub, countByKind(workspace.files), palantir);
  }

  // One event per save (the client debounces keystrokes), plus per-file lifecycle events derived
  // from the diff so "document created/deleted" exist server-side without extra endpoints.
  const previous = existing ? rowToWorkspace(existing)?.workspace ?? null : null;
  const diff = workspaceDiff(previous, workspace);
  const user = locals.user.sub;
  void capture('office_workspace_saved', user, {
    revision: expectedRevision + 1,
    bytes: data.length,
    created: diff.created.length,
    deleted: diff.deleted.length,
    ...countByKind(workspace.files)
  }, palantir);
  for (const file of diff.created) {
    void capture('office_document_created', user, { kind: file.kind, title_length: file.title.length }, palantir);
  }
  for (const file of diff.deleted) {
    void capture('office_document_deleted', user, { kind: file.kind, title_length: file.title.length }, palantir);
  }
  if (diff.tombstoned) void capture('office_document_tombstoned', user, { count: diff.tombstoned }, palantir);

  return json({ workspace, revision: expectedRevision + 1, updatedAt });
};
