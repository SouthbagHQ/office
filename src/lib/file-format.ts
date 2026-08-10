import type { Kind } from '$lib/workspace';

const extensions: Record<Kind, string> = {
  doc: 'southbagdocs',
  slides: 'southbagslides',
  sheet: 'southbagsheets'
};

const mimeTypes: Record<Kind, string> = {
  doc: 'application/vnd.southbag.docs',
  slides: 'application/vnd.southbag.slides',
  sheet: 'application/vnd.southbag.sheets'
};

export function southbagExtension(kind: Kind): string {
  return extensions[kind];
}

export function southbagMimeType(kind: Kind): string {
  return mimeTypes[kind];
}

export function southbagFilename(title: string, kind: Kind): string {
  const stem = title
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120) || 'Untitled';
  return `${stem}.${southbagExtension(kind)}`;
}

export const southbagAccept = '.southbagdocs,.southbagslides,.southbagsheets';
