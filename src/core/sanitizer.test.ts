import { describe, it, expect } from 'vitest';
import { Sanitizer } from './sanitizer';

describe('Sanitizer', () => {
  describe('sanitizeString', () => {
    it('redacts JWT tokens', () => {
      const s = new Sanitizer();
      const input =
        'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123_def';

      expect(s.sanitizeString(input)).toBe('Bearer [REDACTED:jwt]');
    });

    it('redacts email addresses', () => {
      const s = new Sanitizer();
      expect(s.sanitizeString('Contact user@example.com for help')).toBe(
        'Contact [REDACTED:email] for help',
      );
    });

    it('redacts phone numbers', () => {
      const s = new Sanitizer();
      expect(s.sanitizeString('Call +1 555-123-4567')).toBe(
        'Call [REDACTED:phone]',
      );
    });

    it('redacts multiple patterns in one string', () => {
      const s = new Sanitizer();
      const input = 'Email: foo@bar.com, JWT: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
      const result = s.sanitizeString(input);

      expect(result).toContain('[REDACTED:email]');
      expect(result).toContain('[REDACTED:jwt]');
    });

    it('applies custom redact patterns', () => {
      const s = new Sanitizer({
        redactPatterns: [/SSN-\d{3}-\d{2}-\d{4}/],
      });

      expect(s.sanitizeString('ID: SSN-123-45-6789')).toBe(
        'ID: [REDACTED]',
      );
    });

    it('returns unchanged string when nothing matches', () => {
      const s = new Sanitizer();
      expect(s.sanitizeString('Hello world')).toBe('Hello world');
    });
  });

  describe('sanitizeHeaders', () => {
    it('strips Authorization header', () => {
      const s = new Sanitizer();
      const result = s.sanitizeHeaders({
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      });

      expect(result).not.toHaveProperty('Authorization');
      expect(result['Content-Type']).toBe('application/json');
    });

    it('strips Cookie and Set-Cookie headers', () => {
      const s = new Sanitizer();
      const result = s.sanitizeHeaders({
        Cookie: 'session=abc',
        'Set-Cookie': 'session=abc; HttpOnly',
        Accept: 'text/html',
      });

      expect(result).not.toHaveProperty('Cookie');
      expect(result).not.toHaveProperty('Set-Cookie');
      expect(result['Accept']).toBe('text/html');
    });

    it('is case-insensitive for header names', () => {
      const s = new Sanitizer();
      const result = s.sanitizeHeaders({
        AUTHORIZATION: 'Bearer x',
        'content-type': 'text/plain',
      });

      expect(result).not.toHaveProperty('AUTHORIZATION');
      expect(result['content-type']).toBe('text/plain');
    });

    it('sanitizes remaining header values', () => {
      const s = new Sanitizer();
      const result = s.sanitizeHeaders({
        'X-Custom': 'contact user@example.com',
      });

      expect(result['X-Custom']).toBe('contact [REDACTED:email]');
    });

    it('strips custom sensitive headers', () => {
      const s = new Sanitizer({ sensitiveHeaders: ['x-secret'] });
      const result = s.sanitizeHeaders({
        'X-Secret': 'hidden',
        Accept: '*/*',
      });

      expect(result).not.toHaveProperty('X-Secret');
      expect(result['Accept']).toBe('*/*');
    });
  });

  describe('sanitizeUrl', () => {
    it('redacts sensitive query params', () => {
      const s = new Sanitizer();
      const url = 'https://api.example.com/auth?token=abc123&page=1';
      const result = s.sanitizeUrl(url);

      expect(result).toContain('token=%5BREDACTED%5D');
      expect(result).toContain('page=1');
    });

    it('redacts multiple sensitive params', () => {
      const s = new Sanitizer();
      const url = 'https://example.com?password=x&secret=y&name=z';
      const result = s.sanitizeUrl(url);

      expect(result).toContain('password=%5BREDACTED%5D');
      expect(result).toContain('secret=%5BREDACTED%5D');
      expect(result).toContain('name=z');
    });

    it('handles URLs without sensitive params', () => {
      const s = new Sanitizer();
      const url = 'https://example.com/path?page=1&limit=10';
      expect(s.sanitizeUrl(url)).toBe(url);
    });

    it('falls back to string sanitization for invalid URLs', () => {
      const s = new Sanitizer();
      const result = s.sanitizeUrl('not-a-url user@example.com');
      expect(result).toBe('not-a-url [REDACTED:email]');
    });

    it('uses custom sensitive params', () => {
      const s = new Sanitizer({ sensitiveParams: ['session_id'] });
      const url = 'https://example.com?session_id=abc&token=kept';
      const result = s.sanitizeUrl(url);

      expect(result).toContain('session_id=%5BREDACTED%5D');
      // token is NOT redacted because custom params replace defaults
      expect(result).toContain('token=kept');
    });
  });

  describe('sanitizeBody', () => {
    it('truncates bodies exceeding maxBodySize', () => {
      const s = new Sanitizer({ maxBodySize: 20 });
      const body = 'a'.repeat(50);
      const result = s.sanitizeBody(body);

      expect(result).toBe('a'.repeat(20) + '...[TRUNCATED]');
    });

    it('returns null for null input', () => {
      const s = new Sanitizer();
      expect(s.sanitizeBody(null)).toBeNull();
    });

    it('returns null when stripBodies is true', () => {
      const s = new Sanitizer({ stripBodies: true });
      expect(s.sanitizeBody('some body content')).toBeNull();
    });

    it('sanitizes body content', () => {
      const s = new Sanitizer();
      const body = '{"email": "user@example.com"}';
      const result = s.sanitizeBody(body);

      expect(result).toContain('[REDACTED:email]');
    });

    it('uses default maxBodySize of 10000', () => {
      const s = new Sanitizer();
      const body = 'x'.repeat(10_001);
      const result = s.sanitizeBody(body)!;

      expect(result).toContain('...[TRUNCATED]');
      expect(result.startsWith('x'.repeat(10_000))).toBe(true);
    });
  });

  describe('sanitizeObject', () => {
    it('deep-sanitizes nested strings', () => {
      const s = new Sanitizer();
      const obj = {
        user: {
          email: 'test@example.com',
          name: 'John',
        },
        items: ['a@b.com', 'hello'],
      };

      const result = s.sanitizeObject(obj);

      expect(result.user.email).toBe('[REDACTED:email]');
      expect(result.user.name).toBe('John');
      expect(result.items[0]).toBe('[REDACTED:email]');
      expect(result.items[1]).toBe('hello');
    });

    it('preserves non-string values', () => {
      const s = new Sanitizer();
      const obj = { count: 42, active: true, data: null };
      const result = s.sanitizeObject(obj);

      expect(result).toEqual({ count: 42, active: true, data: null });
    });

    it('handles null and undefined', () => {
      const s = new Sanitizer();
      expect(s.sanitizeObject(null)).toBeNull();
      expect(s.sanitizeObject(undefined)).toBeUndefined();
    });

    it('sanitizes top-level string', () => {
      const s = new Sanitizer();
      expect(s.sanitizeObject('user@example.com')).toBe('[REDACTED:email]');
    });
  });
});
