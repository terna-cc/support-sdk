import { describe, it, expect } from 'vitest';
import { sanitizeHtml, renderMarkdown } from './markdown';

describe('sanitizeHtml', () => {
  it('allows permitted tags', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(html)).toBe('<p>Hello <strong>world</strong></p>');
  });

  it('allows em tags', () => {
    const html = '<em>italic</em>';
    expect(sanitizeHtml(html)).toBe('<em>italic</em>');
  });

  it('allows lists', () => {
    const html = '<ul><li>one</li><li>two</li></ul>';
    expect(sanitizeHtml(html)).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('allows ordered lists', () => {
    const html = '<ol><li>first</li><li>second</li></ol>';
    expect(sanitizeHtml(html)).toBe('<ol><li>first</li><li>second</li></ol>');
  });

  it('allows headings h1-h6', () => {
    expect(sanitizeHtml('<h1>Title</h1>')).toBe('<h1>Title</h1>');
    expect(sanitizeHtml('<h2>Title</h2>')).toBe('<h2>Title</h2>');
    expect(sanitizeHtml('<h3>Title</h3>')).toBe('<h3>Title</h3>');
    expect(sanitizeHtml('<h4>Title</h4>')).toBe('<h4>Title</h4>');
    expect(sanitizeHtml('<h5>Title</h5>')).toBe('<h5>Title</h5>');
    expect(sanitizeHtml('<h6>Title</h6>')).toBe('<h6>Title</h6>');
  });

  it('allows code and pre', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    expect(sanitizeHtml(html)).toBe('<pre><code>const x = 1;</code></pre>');
  });

  it('allows br tags', () => {
    const html = 'line1<br>line2';
    expect(sanitizeHtml(html)).toBe('line1<br>line2');
  });

  it('allows anchor tags with safe attributes', () => {
    const html = '<a href="https://example.com">link</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener"');
  });

  it('strips script tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<script');
    // Script tag content is replaced with plain text (safe)
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips event handler attributes', () => {
    const html = '<p onclick="alert(1)">click me</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<p>click me</p>');
  });

  it('strips disallowed tags but keeps text content', () => {
    const html = '<div>Hello <span>world</span></div>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<div');
    expect(result).not.toContain('<span');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('strips img tags', () => {
    const html = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  it('strips iframe tags', () => {
    const html = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<iframe');
  });

  it('blocks javascript: URLs in anchors', () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('javascript:');
  });

  it('blocks javascript: URLs with whitespace', () => {
    const html = '<a href="  javascript:alert(1)">click</a>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('javascript:');
  });

  it('removes HTML comments', () => {
    const html = '<p>Hello</p><!-- comment -->';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<!--');
    expect(result).toBe('<p>Hello</p>');
  });

  it('strips disallowed attributes from allowed tags', () => {
    const html = '<p class="evil" style="color:red">text</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('class=');
    expect(result).not.toContain('style=');
    expect(result).toBe('<p>text</p>');
  });

  it('handles nested disallowed tags', () => {
    const html = '<div><div><p>deep</p></div></div>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<div');
    // Nested disallowed tags get replaced with their text content
    expect(result).toContain('deep');
  });
});

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const result = renderMarkdown('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders italic text', () => {
    const result = renderMarkdown('*italic*');
    expect(result).toContain('<em>italic</em>');
  });

  it('renders unordered lists', () => {
    const result = renderMarkdown('- item 1\n- item 2');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
  });

  it('renders ordered lists', () => {
    const result = renderMarkdown('1. first\n2. second');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>');
    expect(result).toContain('first');
    expect(result).toContain('second');
  });

  it('renders headings', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>');
    expect(renderMarkdown('## Subtitle')).toContain('<h2>');
    expect(renderMarkdown('### H3')).toContain('<h3>');
  });

  it('renders inline code', () => {
    const result = renderMarkdown('use `console.log`');
    expect(result).toContain('<code>console.log</code>');
  });

  it('renders code blocks', () => {
    const result = renderMarkdown('```\nconst x = 1;\n```');
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
    expect(result).toContain('const x = 1;');
  });

  it('renders links safely', () => {
    const result = renderMarkdown('[click](https://example.com)');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener"');
  });

  it('sanitizes script injection attempts', () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script');
  });

  it('renders paragraphs', () => {
    const result = renderMarkdown('Hello world');
    expect(result).toContain('<p>');
    expect(result).toContain('Hello world');
  });

  it('handles empty string', () => {
    const result = renderMarkdown('');
    expect(result).toBe('');
  });
});
