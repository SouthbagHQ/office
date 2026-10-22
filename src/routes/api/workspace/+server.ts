import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { DriveSaveError, driveUser, loadDriveWorkspace, saveDriveWorkspace, type DriveStorage } from '$lib/server/drive';
import { parseWorkspace } from '$lib/server/workspace';
import { capture, palantirOptions } from '$lib/server/palantir';
import type { OfficeFile } from '$lib/workspace';

// The workspace lives in Southbag Drive™ (see $lib/server/drive). Office's own
// D1 is only read once per user, to migrate a pre-Drive workspace.

function countByKind(files: OfficeFile[]) {
  return {
    files: files.length,
    docs: files.filter((file) => file.kind === 'doc').length,
    slides: files.filter((file) => file.kind === 'slides').length,
    sheets: files.filter((file) => file.kind === 'sheet').length
  };
}

function storage(platform: App.Platform | undefined): { drive: DriveStorage; key: string } | null {
  const drive = platform?.env?.DRIVE;
  return drive && env.SOUTHBAG_FILE_KEY ? { drive, key: env.SOUTHBAG_FILE_KEY } : null;
}

function saveFailure(error: unknown) {
  if (error instanceof DriveSaveError) {
    return json({ error: error.message, reason: error.reason }, { status: error.reason === 'storage_full' ? 507 : 502 });
  }
  console.error('Southbag Drive request failed:', error);
  return json({ error: 'Southbag Drive is unavailable.' }, { status: 503 });
}

export const GET: RequestHandler = async ({ platform, locals, request }) => {
  const palantir = palantirOptions(request, platform);
  if (!locals.user) {
    void capture('office_workspace_rejected', undefined, { operation: 'load', reason: 'unauthenticated' }, palantir);
    return json({ error: 'Identity required.' }, { status: 401 });
  }
  const configured = storage(platform);
  if (!configured) {
    void capture('office_workspace_rejected', locals.user.sub, { operation: 'load', reason: 'no_drive' }, palantir);
    return json({ error: 'The Southbag Cloud is unavailable.' }, { status: 503 });
  }
  try {
    const stored = await loadDriveWorkspace(configured.drive, driveUser(locals.user), configured.key, platform?.env.DB ?? null);
    if (!stored) {
      void capture('office_workspace_loaded', locals.user.sub, { empty: true, revision: 0 }, palantir);
      return json({ workspace: null, revision: 0, updatedAt: '', driveIds: {} });
    }
    void capture('office_workspace_loaded', locals.user.sub, { empty: false, revision: stored.revision, ...countByKind(stored.workspace.files) }, palantir);
    return json(stored);
  } catch (error) {
    void capture('office_workspace_rejected', locals.user.sub, { operation: 'load', reason: error instanceof DriveSaveError ? error.reason : 'drive_unavailable' }, palantir);
    return saveFailure(error);
  }
};

export const PUT: RequestHandler = async ({ request, platform, locals }) => {
  const palantir = palantirOptions(request, platform);
  const rejected = (reason: string, extra: Record<string, unknown> = {}) =>
    capture('office_workspace_rejected', locals.user?.sub, { operation: 'save', reason, ...extra }, palantir);
  if (!locals.user) {
    void rejected('unauthenticated');
    return json({ error: 'Identity required.' }, { status: 401 });
  }
  const configured = storage(platform);
  if (!configured) {
    void rejected('no_drive');
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
  const expectedRevision = typeof body?.expectedRevision === 'number' ? body.expectedRevision : 0;
  const user = driveUser(locals.user);

  try {
    const saved = await saveDriveWorkspace(configured.drive, user, configured.key, workspace, expectedRevision);
    if (!saved.ok) {
      const current = await loadDriveWorkspace(configured.drive, user, configured.key, platform?.env.DB ?? null);
      void capture('office_workspace_conflict', locals.user.sub, { expectedRevision, storedRevision: current?.revision ?? 0 }, palantir);
      return json(
        { error: 'Someone else saved first. Please try again.', ...(current ?? { workspace: { files: [] }, revision: 0, updatedAt: '' }) },
        { status: 409 }
      );
    }

    // One event per save (the client debounces keystrokes), plus per-file lifecycle counts.
    void capture('office_workspace_saved', locals.user.sub, {
      revision: saved.revision,
      created: saved.created,
      updated: saved.updated,
      deleted: saved.deleted,
      ...countByKind(workspace.files)
    }, palantir);
    if (saved.created) void capture('office_document_created', locals.user.sub, { count: saved.created }, palantir);
    if (saved.deleted) void capture('office_document_deleted', locals.user.sub, { count: saved.deleted }, palantir);

    return json({ workspace, revision: saved.revision, updatedAt: saved.updatedAt });
  } catch (error) {
    void rejected(error instanceof DriveSaveError ? error.reason : 'drive_unavailable');
    return saveFailure(error);
  }
};
