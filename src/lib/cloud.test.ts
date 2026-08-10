import { describe, expect, it } from 'vitest';
import { mergeWorkspaces } from './cloud';
import { initialWorkspace, type DocumentFile } from './workspace';

describe('workspace conflict merge', () => {
  it('keeps unique files and the newest version of shared files', () => {
    const base = initialWorkspace.files[0] as DocumentFile;
    const older = { ...base, title: 'older', modified: '2026-01-01T00:00:00Z' };
    const newer = { ...base, title: 'newer', modified: '2026-02-01T00:00:00Z' };
    const unique = { ...base, id: 'unique', title: 'unique' };
    const merged = mergeWorkspaces({ files: [older, unique] }, { files: [newer] });
    expect(merged.files).toHaveLength(2);
    expect(merged.files.find((file) => file.id === base.id)?.title).toBe('newer');
  });
});
