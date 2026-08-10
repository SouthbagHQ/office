export type Kind = 'doc' | 'slides' | 'sheet';

export type DocumentFile = {
  id: string;
  kind: 'doc';
  title: string;
  content: string;
  modified: string;
  owner: string;
};

export type Slide = { title: string; body: string; layout: 'title' | 'statement' | 'split' };
export type SlideFile = {
  id: string;
  kind: 'slides';
  title: string;
  slides: Slide[];
  theme: number;
  notes: string;
  modified: string;
  owner: string;
};

export type SheetFile = {
  id: string;
  kind: 'sheet';
  title: string;
  cells: Record<string, string>;
  modified: string;
  owner: string;
};

export type OfficeFile = DocumentFile | SlideFile | SheetFile;
export type Workspace = { files: OfficeFile[]; deletedIds?: string[] };

export const initialWorkspace: Workspace = {
  files: []
};

export function createFile(kind: Kind, owner = 'You'): OfficeFile {
  const modified = new Date().toISOString();
  const common = { id: `${kind}-${crypto.randomUUID()}`, modified, owner };
  if (kind === 'doc') {
    return { ...common, kind, title: 'Untitled document', content: '' };
  }
  if (kind === 'slides') {
    return {
      ...common,
      kind,
      title: 'Untitled presentation',
      slides: [{ title: '', body: '', layout: 'title' }],
      theme: 0,
      notes: ''
    };
  }
  return {
    ...common,
    kind,
    title: 'Untitled spreadsheet',
    cells: {}
  };
}

export function kindLabel(kind: Kind) {
  return kind === 'doc' ? 'Docs' : kind === 'slides' ? 'Slides' : 'Sheets';
}
