import { describe, expect, it } from 'vitest';
import { sanitizeDocumentHtml } from './document-html';

describe('document HTML sanitization', () => {
  it('keeps editor formatting', () => {
    expect(sanitizeDocumentHtml('<h1>Title</h1><div style="text-align: center"><b>Centered</b></div>')).toBe(
      '<h1>Title</h1><div style="text-align:center"><b>Centered</b></div>'
    );
  });

  it('removes executable elements, attributes, and URLs', () => {
    const unsafe =
      '<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">click</a><p onclick="alert(4)" style="background:url(javascript:alert(5));text-align:right">Safe</p>';
    const result = sanitizeDocumentHtml(unsafe);
    expect(result).toBe('<img src="x" /><a>click</a><p style="text-align:right">Safe</p>');
    expect(result).not.toMatch(/script|onerror|onclick|javascript|href/i);
  });

  it('preserves safe links and images', () => {
    const safe =
      '<a href="https://southbag.cc/docs" target="_blank" onclick="bad()">Docs</a><img src="data:image/png;base64,aGVsbG8=" alt="Preview" onload="bad()">';
    expect(sanitizeDocumentHtml(safe)).toBe(
      '<a href="https://southbag.cc/docs" target="_blank" rel="noopener noreferrer">Docs</a><img src="data:image/png;base64,aGVsbG8=" alt="Preview" />'
    );
  });
});
