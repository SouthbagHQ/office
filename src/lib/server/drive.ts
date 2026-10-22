import { newOfficeFileId, type Kind, type OfficeFile, type Workspace } from '$lib/workspace';
import { decryptSouthbagFile, encryptSouthbagFile } from './file-format';
import { parseWorkspace, rowToWorkspace, workspaceOwner, type StoredWorkspace } from './workspace';

// Southbag Drive™ is the storage for every Office document. The Worker reaches
// Drive's `OfficeStorage` RPC entrypoint through the `DRIVE` service binding;
// the entrypoint has no public route, so Drive trusts the user passed here.
// Each document is stored as an encrypted .southbag* package — Drive never
// sees plaintext and never holds SOUTHBAG_FILE_KEY.
//
// These types mirror drive/src/lib/server/office-storage.ts.

export type DriveUser = { sub: string; email: string; name: string };

type DrivePackage = {
  driveFileId: string;
  officeId: string | null;
  name: string;
  kind: Kind;
  modified: string | null;
  bytes: Uint8Array;
};

type DriveState = { exists: boolean; revision: number; updatedAt: string; deletedIds: string[] };

type DriveUpsert = { officeId: string; kind: Kind; title: string; modified: string; bytes: Uint8Array };

type DriveCommitResult =
  | { ok: true; revision: number; updatedAt: string; skipped: string[] }
  | { ok: false; reason: 'conflict' | 'invalid' | 'storage_full' | 'storage_error'; revision: number };

export interface DriveStorage {
  snapshot(user: DriveUser): Promise<DriveState & { packages: DrivePackage[] }>;
  index(user: DriveUser): Promise<DriveState & { entries: { driveFileId: string; officeId: string; modified: string | null }[] }>;
  commit(user: DriveUser, commit: { expectedRevision: number; deletedIds: string[]; upserts: DriveUpsert[] }): Promise<DriveCommitResult>;
  adopt(
    user: DriveUser,
    adoptions: { driveFileId: string; officeId: string; modified: string }[]
  ): Promise<{ revision: number; updatedAt: string; adopted: string[] }>;
}

const MAX_FILES = 250;
const MAX_WORKSPACE_BYTES = 2_000_000;

/** A workspace as stored in Drive, plus which Drive file holds each document. */
export type DriveWorkspace = StoredWorkspace & { driveIds: Record<string, string> };

export class DriveSaveError extends Error {
  constructor(
    readonly reason: 'invalid' | 'storage_full' | 'storage_error',
    message: string
  ) {
    super(message);
  }
}

export function driveUser(user: NonNullable<App.Locals['user']>): DriveUser {
  return { sub: user.sub, email: user.email, name: user.name };
}

function newestFirst(left: OfficeFile, right: OfficeFile) {
  return new Date(right.modified).getTime() - new Date(left.modified).getTime();
}

async function encryptedUpsert(file: OfficeFile, key: string): Promise<DriveUpsert> {
  return { officeId: file.id, kind: file.kind, title: file.title, modified: file.modified, bytes: await encryptSouthbagFile(file, key) };
}

/**
 * Before Drive, workspaces lived in Office's own D1. The first time a user loads
 * with no Drive workspace, copy the old one across. The D1 row is left alone.
 */
async function migrateLegacyWorkspace(drive: DriveStorage, user: DriveUser, db: D1Database | null, key: string) {
  if (!db) return false;
  const row = await db
    .prepare('SELECT data, revision, updated_at FROM workspaces WHERE owner_key = ?')
    .bind(workspaceOwner(user))
    .first<{ data: string; revision: number; updated_at: string }>();
  const legacy = row ? rowToWorkspace(row) : null;
  if (!legacy) return false;
  const deletedIds = legacy.workspace.deletedIds ?? [];
  const upserts = await Promise.all(
    legacy.workspace.files.filter((file) => !deletedIds.includes(file.id)).map((file) => encryptedUpsert(file, key))
  );
  const result = await drive.commit(user, { expectedRevision: 0, deletedIds, upserts });
  if (!result.ok && result.reason !== 'conflict') {
    throw new DriveSaveError(result.reason === 'storage_full' ? 'storage_full' : 'storage_error', 'Your old workspace could not be moved to Southbag Drive.');
  }
  return true;
}

/** Rebuild the workspace from Drive. Returns null when the user has nothing anywhere yet. */
export async function loadDriveWorkspace(
  drive: DriveStorage,
  user: DriveUser,
  key: string,
  legacyDb: D1Database | null
): Promise<DriveWorkspace | null> {
  let snapshot = await drive.snapshot(user);
  if (!snapshot.exists && (await migrateLegacyWorkspace(drive, user, legacyDb, key))) {
    snapshot = await drive.snapshot(user);
  }

  const deleted = new Set(snapshot.deletedIds);
  const candidates: { file: OfficeFile; driveFileId: string; adopt: boolean }[] = [];
  for (const item of snapshot.packages) {
    if (item.officeId && deleted.has(item.officeId)) continue;
    try {
      const file = await decryptSouthbagFile(item.bytes, key);
      // Packages uploaded straight into Drive get a fresh id, so two uploads of
      // the same export never collide.
      const id = item.officeId ?? newOfficeFileId(file.kind);
      candidates.push({ file: { ...file, id }, driveFileId: item.driveFileId, adopt: !item.officeId });
    } catch {
      // Not ours to open (another key, or not really a package). It stays a plain Drive file.
    }
  }

  // Drive can hold more than one workspace's worth; keep the newest that fit.
  candidates.sort((left, right) => newestFirst(left.file, right.file));
  const kept: typeof candidates = [];
  let bytes = JSON.stringify({ files: [], deletedIds: snapshot.deletedIds }).length;
  for (const candidate of candidates) {
    const size = JSON.stringify(candidate.file).length + 1;
    if (kept.length >= MAX_FILES || bytes + size > MAX_WORKSPACE_BYTES) continue;
    kept.push(candidate);
    bytes += size;
  }

  let { revision, updatedAt } = snapshot;
  const adoptions = kept.filter((item) => item.adopt);
  if (adoptions.length) {
    const adopted = await drive.adopt(
      user,
      adoptions.map((item) => ({ driveFileId: item.driveFileId, officeId: item.file.id, modified: item.file.modified }))
    );
    ({ revision, updatedAt } = adopted);
    const accepted = new Set(adopted.adopted);
    // Lost a race to another tab's adoption: that tab's id wins on the next load.
    for (let index = kept.length - 1; index >= 0; index--) {
      if (kept[index].adopt && !accepted.has(kept[index].driveFileId)) kept.splice(index, 1);
    }
  }

  if (!snapshot.exists && !kept.length && revision === 0) return null;
  const workspace = parseWorkspace({
    files: kept.map((item) => item.file),
    ...(snapshot.deletedIds.length ? { deletedIds: snapshot.deletedIds } : {})
  });
  if (!workspace) throw new Error('Drive returned a workspace Office cannot read.');
  return {
    workspace,
    revision,
    updatedAt,
    driveIds: Object.fromEntries(kept.map((item) => [item.driveFileId, item.file.id]))
  };
}

export type DriveSaveResult =
  | { ok: true; revision: number; updatedAt: string; created: number; updated: number; deleted: number }
  | { ok: false; conflict: true };

/**
 * Save a workspace to Drive. Only documents whose `modified` differs from the
 * Drive copy are re-encrypted and written. Tombstoned ids Drive refused to
 * write come back as a conflict so the browser merges the tombstone in.
 */
export async function saveDriveWorkspace(
  drive: DriveStorage,
  user: DriveUser,
  key: string,
  workspace: Workspace,
  expectedRevision: number
): Promise<DriveSaveResult> {
  const index = await drive.index(user);
  if (index.revision !== expectedRevision) return { ok: false, conflict: true };

  const stored = new Map(index.entries.map((entry) => [entry.officeId, entry.modified]));
  const alreadyDeleted = new Set(index.deletedIds);
  const deletedIds = [...new Set(workspace.deletedIds ?? [])];
  const deleted = new Set(deletedIds);
  const changed = workspace.files.filter(
    (file) => !deleted.has(file.id) && !alreadyDeleted.has(file.id) && stored.get(file.id) !== file.modified
  );
  const upserts = await Promise.all(changed.map((file) => encryptedUpsert(file, key)));
  const result = await drive.commit(user, { expectedRevision, deletedIds, upserts });

  if (!result.ok) {
    if (result.reason === 'conflict') return { ok: false, conflict: true };
    if (result.reason === 'storage_full') {
      throw new DriveSaveError('storage_full', 'Southbag Drive is full. Delete something in Drive to keep saving.');
    }
    throw new DriveSaveError(result.reason, 'Southbag Drive would not take the save.');
  }
  const missedTombstone = workspace.files.some((file) => alreadyDeleted.has(file.id) && !deleted.has(file.id));
  if (result.skipped.length || missedTombstone) return { ok: false, conflict: true };
  return {
    ok: true,
    revision: result.revision,
    updatedAt: result.updatedAt,
    created: changed.filter((file) => !stored.has(file.id)).length,
    updated: changed.filter((file) => stored.has(file.id)).length,
    deleted: deletedIds.filter((id) => stored.has(id)).length
  };
}
