const allowedTags = new Set([
  'p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'blockquote', 'span', 'a', 'img'
]);
const nonTextTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript']);
const textAlignPattern = /(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\s*(?:;|$)/i;
const safeImageDataPattern = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i;

function isSafeUrl(value: string, image: boolean): boolean {
  const candidate = value.trim();
  if (image && safeImageDataPattern.test(candidate)) return true;
  if (candidate.startsWith('#') || /^(?:\/|\.\.?\/)(?!\/)/.test(candidate)) return true;
  try {
    const parsed = new URL(candidate, document.baseURI);
    return image ? ['http:', 'https:'].includes(parsed.protocol) : ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeDocumentHtml(content: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(content, 'text/html');
  const elements = Array.from(parsed.body.querySelectorAll('*')).reverse();
  for (const element of elements) {
    const tag = element.tagName.toLowerCase();
    if (!allowedTags.has(tag)) {
      if (nonTextTags.has(tag)) element.remove();
      else element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    const style = element.getAttribute('style') ?? '';
    const textAlign = style.match(textAlignPattern)?.[1]?.toLowerCase();
    const href = element.getAttribute('href') ?? '';
    const src = element.getAttribute('src') ?? '';
    const title = element.getAttribute('title') ?? '';
    const alt = element.getAttribute('alt') ?? '';
    const width = element.getAttribute('width') ?? '';
    const height = element.getAttribute('height') ?? '';
    const opensNewWindow = element.getAttribute('target') === '_blank';
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);

    if (textAlign) element.setAttribute('style', `text-align:${textAlign}`);
    if (title) element.setAttribute('title', title);
    if (tag === 'a' && href && isSafeUrl(href, false)) {
      element.setAttribute('href', href);
      if (opensNewWindow) {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (tag === 'img' && src && isSafeUrl(src, true)) {
      element.setAttribute('src', src);
      if (alt) element.setAttribute('alt', alt);
      if (/^\d{1,4}$/.test(width)) element.setAttribute('width', width);
      if (/^\d{1,4}$/.test(height)) element.setAttribute('height', height);
    }
  }
  return parsed.body.innerHTML;
}
