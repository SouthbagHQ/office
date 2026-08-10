import { describe, expect, it } from 'vitest';
import { createFile, initialWorkspace } from '../workspace';
import { parseWorkspace, rowToWorkspace } from './workspace';

describe('cloud workspace validation', () => {
  it('accepts the product workspace shape', () => {
    expect(parseWorkspace(initialWorkspace)).toEqual(initialWorkspace);
  });

  it('rejects invalid or excessively large workspaces', () => {
    const document = createFile('doc', 'Test Employee');
    expect(parseWorkspace({ files: [{ kind: 'doc' }] })).toBeNull();
    expect(parseWorkspace({ files: [{ ...document, content: 'x'.repeat(2_100_000) }] })).toBeNull();
    expect(parseWorkspace({ files: [], deletedIds: [42] })).toBeNull();
  });

  it('turns D1 rows into versioned workspaces', () => {
    expect(rowToWorkspace({ data: JSON.stringify(initialWorkspace), revision: 4, updated_at: 'now' })).toEqual({
      workspace: initialWorkspace,
      revision: 4,
      updatedAt: 'now'
    });
  });
});
