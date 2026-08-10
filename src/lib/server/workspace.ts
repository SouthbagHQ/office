import type { Cookies } from '@sveltejs/kit';
import type { Workspace } from '$lib/workspace';

const GUEST_COOKIE = 'southbag_office_guest';
const MAX_WORKSPACE_BYTES = 2_000_000;

export function workspaceOwner(user: App.Locals['user'], cookies: Cookies, secure: boolean): string {
  if (user) return `user:${user.sub}`;

  let guestId = cookies.get(GUEST_COOKIE);
  if (!guestId || !/^[a-f0-9-]{36}$/i.test(guestId)) {
    guestId = crypto.randomUUID();
    cookies.set(GUEST_COOKIE, guestId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 365 * 24 * 60 * 60
    });
  }
  return `guest:${guestId}`;
}

export function parseWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Workspace).files)) return null;
  const workspace = value as Workspace;
  if (workspace.files.length > 250) return null;

  for (const file of workspace.files) {
    if (!file || typeof file !== 'object') return null;
    if (typeof file.id !== 'string' || file.id.length > 160) return null;
    if (typeof file.title !== 'string' || file.title.length > 500) return null;
    if (typeof file.modified !== 'string' || typeof file.owner !== 'string' || file.owner.length > 500) return null;
    if (!['doc', 'slides', 'sheet'].includes(file.kind)) return null;
    if (file.kind === 'doc' && typeof file.content !== 'string') return null;
    if (
      file.kind === 'slides' &&
      (!Array.isArray(file.slides) ||
        typeof file.notes !== 'string' ||
        !file.slides.every(
          (slide) =>
            slide &&
            typeof slide.title === 'string' &&
            typeof slide.body === 'string' &&
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

  return JSON.stringify(workspace).length <= MAX_WORKSPACE_BYTES ? workspace : null;
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
