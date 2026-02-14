import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNetworkCapture } from './network';
import { Sanitizer } from '../core/sanitizer';

describe('createNetworkCapture', () => {
  let sanitizer: Sanitizer;
  let originalFetch: typeof globalThis.fetch;
  let originalXHROpen: typeof XMLHttpRequest.prototype.open;
  let originalXHRSend: typeof XMLHttpRequest.prototype.send;
  let originalXHRSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader;

  beforeEach(() => {
    sanitizer = new Sanitizer();
    originalFetch = globalThis.fetch;
    originalXHROpen = XMLHttpRequest.prototype.open;
    originalXHRSend = XMLHttpRequest.prototype.send;
    originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  });

  afterEach(() => {
    // Safety net: restore globals
    globalThis.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalXHROpen;
    XMLHttpRequest.prototype.send = originalXHRSend;
    XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
  });

  describe('fetch interception', () => {
    it('captures fetch requests with correct metadata', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('{"ok":true}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"test"}',
      });

      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.method).toBe('POST');
      expect(entry.url).toContain('api.example.com/data');
      expect(entry.status).toBe(200);
      expect(entry.requestBody).toBe('{"name":"test"}');
      expect(entry.responseBody).toBe('{"ok":true}');
      expect(entry.duration).toBeTypeOf('number');
      expect(entry.duration).toBeGreaterThanOrEqual(0);
      expect(entry.timestamp).toBeTypeOf('number');

      capture.stop();
    });

    it('sanitizes URLs', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/auth?token=secret123&page=1');

      const entries = capture.getEntries();
      expect(entries[0].url).toContain('token=%5BREDACTED%5D');
      expect(entries[0].url).toContain('page=1');

      capture.stop();
    });

    it('sanitizes request and response headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain', 'x-custom': 'value' },
        }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/data', {
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
        },
        body: '{}',
      });

      const entries = capture.getEntries();
      // Authorization should be stripped
      expect(entries[0].requestHeaders).not.toHaveProperty('Authorization');
      expect(entries[0].requestHeaders['Content-Type']).toBe('application/json');

      capture.stop();
    });

    it('sanitizes request and response bodies', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('{"email":"user@example.com"}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email":"admin@test.com"}',
      });

      const entries = capture.getEntries();
      expect(entries[0].requestBody).toContain('[REDACTED:email]');
      expect(entries[0].responseBody).toContain('[REDACTED:email]');

      capture.stop();
    });

    it('logs binary responses as [binary, ...]', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(new Uint8Array(100), {
          status: 200,
          headers: { 'content-type': 'image/png', 'content-length': '100' },
        }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/image.png');

      const entries = capture.getEntries();
      expect(entries[0].responseBody).toBe('[binary, 100 bytes]');

      capture.stop();
    });

    it('truncates bodies exceeding maxBodySize', async () => {
      const largeBody = 'x'.repeat(200);
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(largeBody, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50, 100);
      capture.start();

      await fetch('https://api.example.com/data', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: largeBody,
      });

      const entries = capture.getEntries();
      expect(entries[0].requestBody).toContain('[truncated, 200 bytes total]');
      expect(entries[0].responseBody).toContain('[truncated, 200 bytes total]');

      capture.stop();
    });

    it('stop() restores original fetch', () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      expect(globalThis.fetch).not.toBe(mockFetch);

      capture.stop();
      expect(globalThis.fetch).toBe(mockFetch);
    });

    it('records duration', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/data');

      const entries = capture.getEntries();
      expect(entries[0].duration).toBeTypeOf('number');
      expect(entries[0].duration).toBeGreaterThanOrEqual(0);

      capture.stop();
    });

    it('excludes SDK own requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50) as ReturnType<typeof createNetworkCapture> & {
        setExcludedEndpoint: (endpoint: string) => void;
      };
      capture.setExcludedEndpoint('https://api.support.com/reports');
      capture.start();

      // This request should be excluded
      await fetch('https://api.support.com/reports', { method: 'POST' });
      // This request should be captured
      await fetch('https://api.example.com/data');

      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].url).toContain('api.example.com');

      capture.stop();
    });

    it('captures failed fetch requests', async () => {
      const error = new Error('Network error');
      const mockFetch = vi.fn().mockRejectedValue(error);
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await expect(fetch('https://api.example.com/fail')).rejects.toThrow('Network error');

      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBeNull();

      capture.stop();
    });

    it('handles fetch with URL object', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch(new URL('https://api.example.com/data'));

      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].url).toContain('api.example.com/data');

      capture.stop();
    });

    it('defaults method to GET', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/data');

      const entries = capture.getEntries();
      expect(entries[0].method).toBe('GET');

      capture.stop();
    });
  });

  describe('XHR interception', () => {
    // jsdom's XHR tries to make real network requests which causes timeouts.
    // We replace the global XMLHttpRequest with a fake before capture.start().
    let xhrInstances: FakeXHR[];
    let RealXHR: typeof XMLHttpRequest;

    class FakeXHR extends EventTarget {
      readyState = 0;
      status = 0;
      responseText = '';
      responseType = '';
      response: string | null = '';

      open(_method: string, _url: string | URL, ..._rest: unknown[]) {
        this.readyState = 1;
      }

      setRequestHeader(_name: string, _value: string) {
        // no-op base
      }

      send(_body?: unknown) {
        xhrInstances.push(this);
      }

      getAllResponseHeaders() {
        return '';
      }

      abort() {}

      /** Test helper: simulate a completed response */
      _respond(status: number, headers: Record<string, string>, body: string) {
        Object.defineProperty(this, 'getAllResponseHeaders', {
          value: () =>
            Object.entries(headers)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\r\n'),
        });
        this.status = status;
        this.responseText = body;
        this.response = body;
        this.readyState = 4;
        this.dispatchEvent(new Event('loadend'));
      }
    }

    beforeEach(() => {
      xhrInstances = [];
      RealXHR = globalThis.XMLHttpRequest;
      // Install our fake as the global XMLHttpRequest
      (globalThis as unknown as Record<string, unknown>).XMLHttpRequest = FakeXHR;
    });

    afterEach(() => {
      // Restore real XMLHttpRequest
      (globalThis as unknown as Record<string, unknown>).XMLHttpRequest = RealXHR;
    });

    it('captures XHR requests with correct metadata', () => {
      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://api.example.com/data');
      xhr.send();

      // Simulate server response
      xhrInstances[0]._respond(200, { 'content-type': 'application/json' }, '{"ok":true}');

      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].method).toBe('GET');
      expect(entries[0].url).toContain('api.example.com/data');
      expect(entries[0].status).toBe(200);
      expect(entries[0].responseBody).toBe('{"ok":true}');
      expect(entries[0].duration).toBeTypeOf('number');
      expect(entries[0].duration).toBeGreaterThanOrEqual(0);

      capture.stop();
    });

    it('stop() restores original XHR prototype methods', () => {
      const openBefore = XMLHttpRequest.prototype.open;
      const sendBefore = XMLHttpRequest.prototype.send;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      expect(XMLHttpRequest.prototype.open).not.toBe(openBefore);
      expect(XMLHttpRequest.prototype.send).not.toBe(sendBefore);

      capture.stop();

      expect(XMLHttpRequest.prototype.open).toBe(openBefore);
      expect(XMLHttpRequest.prototype.send).toBe(sendBefore);
    });

    it('excludes SDK own XHR requests', () => {
      const capture = createNetworkCapture(sanitizer, 50) as ReturnType<typeof createNetworkCapture> & {
        setExcludedEndpoint: (endpoint: string) => void;
      };
      capture.setExcludedEndpoint('https://api.support.com/reports');
      capture.start();

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.support.com/reports');
      xhr.send();

      // The excluded request's send calls the original (mock) send which pushes to xhrInstances,
      // but no loadend listener is added by the capture module. Simulate response anyway.
      if (xhrInstances.length > 0) {
        xhrInstances[0]._respond(200, {}, 'ok');
      }

      const entries = capture.getEntries();
      expect(entries).toHaveLength(0);

      capture.stop();
    });

    it('captures XHR request headers and sanitizes them', () => {
      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.example.com/data');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer secret');
      xhr.send('{"test":true}');

      xhrInstances[0]._respond(200, { 'content-type': 'application/json' }, '{"ok":true}');

      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      // Authorization should be stripped
      expect(entries[0].requestHeaders).not.toHaveProperty('Authorization');
      expect(entries[0].requestHeaders['Content-Type']).toBe('application/json');

      capture.stop();
    });
  });

  describe('buffer operations', () => {
    it('freeze() returns a copy', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/first');
      const frozen = capture.freeze();

      await fetch('https://api.example.com/second');

      expect(frozen).toHaveLength(1);
      expect(capture.getEntries()).toHaveLength(2);

      capture.stop();
    });

    it('clear() empties the buffer', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
      globalThis.fetch = mockFetch;

      const capture = createNetworkCapture(sanitizer, 50);
      capture.start();

      await fetch('https://api.example.com/data');
      expect(capture.getEntries()).toHaveLength(1);

      capture.clear();
      expect(capture.getEntries()).toHaveLength(0);

      capture.stop();
    });
  });
});
