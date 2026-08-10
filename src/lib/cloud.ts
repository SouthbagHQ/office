import type { OfficeFile, Workspace } from '$lib/workspace';

export type CloudWorkspace = {
  workspace: Workspace;
  revision: number;
  updatedAt: string;
  error?: string;
};

function newest(left: OfficeFile, right: OfficeFile): OfficeFile {
  return new Date(left.modified).getTime() >= new Date(right.modified).getTime() ? left : right;
}

export function mergeWorkspaces(local: Workspace, remote: Workspace): Workspace {
  const merged = new Map<string, OfficeFile>();
  for (const file of remote.files) merged.set(file.id, file);
  for (const file of local.files) {
    const existing = merged.get(file.id);
    merged.set(file.id, existing ? newest(file, existing) : file);
  }
  return {
    files: [...merged.values()].sort(
      (left, right) => new Date(right.modified).getTime() - new Date(left.modified).getTime()
    )
  };
}
