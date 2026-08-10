import type { Workspace } from '$lib/workspace';
import { sanitizeDocumentHtml } from './document-html';

const MAX_WORKSPACE_BYTES = 2_000_000;

export function workspaceOwner(user: App.Locals['user']): string {
  if (!user) throw new Error('Identity required for workspace ownership.');
  return `user:${user.sub}`;
}

export function parseWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Workspace).files)) return null;
  const workspace = value as Workspace;
  if (workspace.files.length > 250) return null;
  if (
    workspace.deletedIds !== undefined &&
    (!Array.isArray(workspace.deletedIds) ||
      workspace.deletedIds.length > 1000 ||
      !workspace.deletedIds.every((id) => typeof id === 'string' && id.length <= 160))
  ) return null;

  for (const file of workspace.files) {
    if (!file || typeof file !== 'object') return null;
    if (typeof file.id !== 'string' || file.id.length > 160) return null;
    if (typeof file.title !== 'string' || file.title.length > 500) return null;
    if (typeof file.modified !== 'string' || typeof file.owner !== 'string' || file.owner.length > 500) return null;
    if (!['doc', 'slides', 'sheet'].includes(file.kind)) return null;
    if (file.kind === 'doc' && (typeof file.content !== 'string' || file.content.length > 1_800_000)) return null;
    if (
      file.kind === 'slides' &&
      (!Array.isArray(file.slides) ||
        file.slides.length === 0 ||
        file.slides.length > 500 ||
        !Number.isInteger(file.theme) ||
        file.theme < 0 ||
        file.theme > 2 ||
        typeof file.notes !== 'string' ||
        file.notes.length > 200_000 ||
        !file.slides.every(
          (slide) =>
            slide &&
            typeof slide.title === 'string' &&
            slide.title.length <= 10_000 &&
            typeof slide.body === 'string' &&
            slide.body.length <= 100_000 &&
            ['title', 'statement', 'split'].includes(slide.layout)
        ))
    ) return null;
    if (
      file.kind === 'sheet' &&
      (!file.cells ||
        typeof file.cells !== 'object' ||
        !Object.entries(file.cells).every(
          ([name, cell]) => /^[A-Z]+\d+$/.test(name) && typeof cell === 'string'
        ))
    ) return null;
  }

  if (JSON.stringify(workspace).length > MAX_WORKSPACE_BYTES) return null;
  return {
    ...workspace,
    files: workspace.files.map((file) =>
      file.kind === 'doc' ? { ...file, content: sanitizeDocumentHtml(file.content) } : file
    )
  };
}

export type StoredWorkspace = {
  workspace: Workspace;
  revision: number;
  updatedAt: string;
};

export function rowToWorkspace(row: { data: string; revision: number; updated_at: string }): StoredWorkspace | null {
  try {
    const workspace = parseWorkspace(JSON.parse(row.data));
    return workspace ? { workspace, revision: row.revision, updatedAt: row.updated_at } : null;
  } catch {
    return null;
  }
}
