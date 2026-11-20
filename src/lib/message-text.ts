import { compile } from 'html-to-text';

const htmlStructure = /<!doctype\s+html\b|<(?:html|head|body|br|hr|img)(?=[\s/>])/i;
const htmlElements = 'p|div|pre|blockquote|ul|ol|li|table|section|article|span|a|b|strong|i|em|u|h[1-6]|script|style|template';
const openingHtmlElement = new RegExp(`<(?:${htmlElements})(?=[\\s>])`, 'i');
const closingHtmlElement = new RegExp(`</(?:${htmlElements})\\s*>`, 'i');

const convertHtml = compile({
  wordwrap: false,
  limits: { maxDepth: 100 },
  selectors: [
    ...['head', 'script', 'style', 'template', 'noscript', '[hidden]', 'img']
      .map(selector => ({ selector, format: 'skip' })),
    { selector: 'a', options: { hideLinkHrefIfSameAsText: true, noAnchorUrl: true } },
    { selector: 'table', format: 'dataTable', options: { uppercaseHeaderCells: false } },
    ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      .map(selector => ({ selector, options: { uppercase: false } })),
  ],
});

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function messageText(value: unknown, format: 'auto' | 'html' = 'auto'): string {
  if (typeof value !== 'string') return '';
  const text = normalizeLineEndings(value);
  const html = format === 'html' || htmlStructure.test(text) || (openingHtmlElement.test(text) && closingHtmlElement.test(text));
  return html ? convertHtml(text) : text;
}

export function storedMessageText(value: string): string {
  // Older records may contain HTML. Plain messages often quote markup inline.
  return value.trimStart().startsWith('<') || /<br\s*\/?>/i.test(value)
    ? messageText(value) : normalizeLineEndings(value);
}
