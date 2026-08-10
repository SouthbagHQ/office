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

  it('rejects presentations that the editor cannot open', () => {
    const presentation = createFile('slides', 'Test Employee');
    if (presentation.kind !== 'slides') throw new Error('Expected a presentation fixture.');
    expect(parseWorkspace({ files: [{ ...presentation, slides: [] }] })).toBeNull();
    expect(parseWorkspace({ files: [{ ...presentation, theme: 3 }] })).toBeNull();
    expect(parseWorkspace({ files: [{ ...presentation, theme: undefined }] })).toBeNull();
    expect(
      parseWorkspace({ files: [{ ...presentation, slides: [{ ...presentation.slides[0], title: 'x'.repeat(10_001) }] }] })
    ).toBeNull();
  });

  it('sanitizes document HTML before it reaches storage', () => {
    const document = createFile('doc', 'Test Employee');
    const parsed = parseWorkspace({
      files: [{ ...document, content: '<p onclick="steal()">Memo</p><script>steal()</script>' }]
    });
    expect(parsed?.files[0]).toMatchObject({ kind: 'doc', content: '<p>Memo</p>' });
  });

  it('turns D1 rows into versioned workspaces', () => {
    expect(rowToWorkspace({ data: JSON.stringify(initialWorkspace), revision: 4, updated_at: 'now' })).toEqual({
      workspace: initialWorkspace,
      revision: 4,
      updatedAt: 'now'
    });
  });
});
