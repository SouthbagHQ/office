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
export type Workspace = { files: OfficeFile[] };

const now = new Date('2026-08-10T09:44:00Z').toISOString();

export const initialWorkspace: Workspace = {
  files: [
    {
      id: 'doc-quarterly-apology',
      kind: 'doc',
      title: 'Quarterly apology — FINAL v8 real',
      content:
        '<h1>Quarterly apology</h1><p><strong>Prepared for:</strong> everyone affected</p><p>We acknowledge that the previous apology contained several formatting errors and one operational error.</p><h2>Next steps</h2><ul><li>Circle back diagonally</li><li>Review the review process</li><li>Move the deadline to a safer location</li></ul><p>Thank you for continuing to use Southbag.</p>',
      modified: now,
      owner: 'Kevin (watching)'
    },
    {
      id: 'slides-growth',
      kind: 'slides',
      title: 'Growth story (do not present)',
      slides: [
        { title: 'growth, but sideways', body: 'FY2026 // CONFIDENTIALISH', layout: 'title' },
        { title: 'The situation', body: 'Revenue is a feeling\nMomentum is a direction\nMargins are decorative', layout: 'statement' },
        { title: 'One clear number', body: '18.4%\nUnclear what it measures', layout: 'split' }
      ],
      theme: 0,
      notes: 'Open with confidence. Do not define growth.',
      modified: now,
      owner: 'You, allegedly'
    },
    {
      id: 'sheet-lunch',
      kind: 'sheet',
      title: 'Lunch budget (mission critical)',
      cells: {
        A1: 'Item', B1: 'Owner', C1: 'Quantity', D1: 'Price', E1: 'Total',
        A2: 'Tiny sandwiches', B2: 'Operations', C2: '12', D2: '4.5', E2: '=C2*D2',
        A3: 'Large napkin', B3: 'Finance', C3: '1', D3: '18', E3: '=C3*D3',
        A4: 'Meeting olives', B4: 'Kevin', C4: '30', D4: '0.8', E4: '=C4*D4',
        A6: 'Approved-ish total', E6: '=SUM(E2:E4)'
      },
      modified: now,
      owner: 'Procurement friend'
    }
  ]
};

export function createFile(kind: Kind, number: number): OfficeFile {
  const modified = new Date().toISOString();
  const common = { id: `${kind}-${Date.now()}-${number}`, modified, owner: 'You (pending review)' };
  if (kind === 'doc') {
    return { ...common, kind, title: `Untitled final document ${number}`, content: '<h1>Start in the middle</h1><p><br></p>' };
  }
  if (kind === 'slides') {
    return {
      ...common,
      kind,
      title: `Deck ${number} (deck)`,
      slides: [{ title: 'A presentation occurred', body: 'Click the words even though they look finished', layout: 'title' }],
      theme: number % 3,
      notes: 'Private notes, displayed directly under the slide.'
    };
  }
  return {
    ...common,
    kind,
    title: `Workbook without a book ${number}`,
    cells: { A1: 'Begin at B2', B2: '=2+2' }
  };
}

export function kindLabel(kind: Kind) {
  return kind === 'doc' ? 'Docs' : kind === 'slides' ? 'Slides' : 'Sheets';
}
