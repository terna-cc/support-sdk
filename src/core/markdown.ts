import { marked } from 'marked';

// ─── Allowed HTML tags and attributes for sanitization ─────────────
const ALLOWED_TAGS = new Set([
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'code',
  'pre',
  'br',
  'a',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
};

// ─── Sanitize HTML using an allowlist approach ─────────────────────

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);

  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      // Text nodes are safe
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        // Replace disallowed tag with its text content
        const textNode = document.createTextNode(el.textContent ?? '');
        node.replaceChild(textNode, child);
        continue;
      }

      // Strip disallowed attributes
      const allowedAttrs = ALLOWED_ATTRS[tagName];
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (!allowedAttrs || !allowedAttrs.has(attr.name)) {
          el.removeAttribute(attr.name);
        }
      }

      // For anchor tags, enforce safe defaults
      if (tagName === 'a') {
        const href = el.getAttribute('href') ?? '';
        // Block javascript: URLs
        if (href.toLowerCase().trimStart().startsWith('javascript:')) {
          el.removeAttribute('href');
        }
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }

      // Recurse into children
      sanitizeNode(child);
    } else {
      // Remove comments and other node types
      node.removeChild(child);
    }
  }
}

// ─── Parse markdown to sanitized HTML ──────────────────────────────

// Configure marked for synchronous parsing
marked.setOptions({
  async: false,
  gfm: true,
  breaks: true,
});

export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown) as string;
  return sanitizeHtml(rawHtml);
}
