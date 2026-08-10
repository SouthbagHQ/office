import sanitizeHtml from 'sanitize-html';

const allowedTags = [
  'p',
  'div',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'span',
  'a',
  'img'
];

export function sanitizeDocumentHtml(content: string): string {
  return sanitizeHtml(content, {
    allowedTags,
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'title', { name: 'target', values: ['_blank'] }, 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['data'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        'text-align': [/^(?:left|right|center|justify)$/]
      }
    },
    transformTags: {
      a: (tagName, attributes) => {
        const transformed = { ...attributes };
        if (transformed.target === '_blank') transformed.rel = 'noopener noreferrer';
        else {
          delete transformed.target;
          delete transformed.rel;
        }
        return { tagName, attribs: transformed };
      }
    },
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true
  });
}
