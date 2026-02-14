import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTransport } from './http';
import type { DiagnosticReport } from '../types';

function makeReport(
  overrides: Partial<DiagnosticReport> = {},
): DiagnosticReport {
  return {
    description: 'Test report',
    console: [],
    network: [],
    breadcrumbs: [],
    browser: {
      userAgent: 'test',
      browser: 'Test 1.0',
      os: 'TestOS',
      language: 'en',
      platform: 'test',
      timezone: 'UTC',
      online: true,
      screenWidth: 1920,
      screenHeight: 1080,
      viewportWidth: 1920,
      viewportHeight: 1080,
      devicePixelRatio: 1,
      url: 'https://example.com',
      referrer: '',
    },
    screenshot: null,
    errors: [],
    user: null,
    metadata: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('createTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('sendReport — FormData structure', () => {
    it('sends report as JSON string in FormData', async () => {
      const report = makeReport({ description: 'Bug found' });
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-1' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(report);
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedBody).toBeInstanceOf(FormData);
      const reportField = capturedBody!.get('report') as string;
      expect(JSON.parse(reportField)).toEqual(report);
    });

    it('includes screenshot in FormData when provided', async () => {
      const report = makeReport();
      const screenshot = new Blob(['fake-image'], { type: 'image/jpeg' });
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-2' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(report, screenshot);
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedBody!.get('screenshot')).toBeInstanceOf(File);
    });

    it('does not include screenshot field when not provided', async () => {
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-3' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedBody!.get('screenshot')).toBeNull();
    });

    it('POSTs to {endpoint}/reports', async () => {
      let capturedUrl = '';

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          capturedUrl = url;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-4' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com/support',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedUrl).toBe('https://api.test.com/support/reports');
    });

    it('strips trailing slashes from endpoint', async () => {
      let capturedUrl = '';

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          capturedUrl = url;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-5' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com/support/',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedUrl).toBe('https://api.test.com/support/reports');
    });
  });

  describe('sendReport — authentication', () => {
    it('sends API key in configured header', async () => {
      let capturedHeaders: Headers | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedHeaders = init.headers as Headers;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-1' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'api-key', key: 'sk_test_123' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedHeaders!.get('X-Project-Key')).toBe('sk_test_123');
    });

    it('sends API key in custom header when headerName is set', async () => {
      let capturedHeaders: Headers | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedHeaders = init.headers as Headers;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-2' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'api-key', key: 'my-key', headerName: 'X-Custom-Key' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedHeaders!.get('X-Custom-Key')).toBe('my-key');
    });

    it('sends bearer token as Authorization header (string)', async () => {
      let capturedHeaders: Headers | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedHeaders = init.headers as Headers;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-3' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'bearer', token: 'my-token' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedHeaders!.get('Authorization')).toBe('Bearer my-token');
    });

    it('calls bearer token function and awaits result', async () => {
      const tokenFn = vi.fn().mockResolvedValue('async-token');
      let capturedHeaders: Headers | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedHeaders = init.headers as Headers;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-4' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'bearer', token: tokenFn },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(tokenFn).toHaveBeenCalledOnce();
      expect(capturedHeaders!.get('Authorization')).toBe('Bearer async-token');
    });

    it('sends custom headers via handler function', async () => {
      let capturedHeaders: Headers | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedHeaders = init.headers as Headers;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-5' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: {
          type: 'custom',
          handler: (headers) => {
            headers.set('X-Custom-Auth', 'custom-value');
          },
        },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedHeaders!.get('X-Custom-Auth')).toBe('custom-value');
    });

    it('sends no auth headers when type is none', async () => {
      let capturedHeaders: Headers | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedHeaders = init.headers as Headers;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-6' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect([...capturedHeaders!.entries()]).toEqual([]);
    });
  });

  describe('sendReport — success', () => {
    it('returns success with reportId on 201', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            new Response(JSON.stringify({ id: 'report-uuid-123' }), {
              status: 201,
            }),
          ),
        ),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      const result = await promise;

      expect(result).toEqual({
        success: true,
        reportId: 'report-uuid-123',
      });
    });
  });

  describe('sendReport — timeout', () => {
    it('aborts request after configured timeout', async () => {
      let capturedSignal: AbortSignal | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedSignal = init.signal as AbortSignal;
          return new Promise((_resolve, reject) => {
            capturedSignal!.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
        timeout: 5000,
        maxRetries: 0,
      });

      const promise = transport.sendReport(makeReport());

      // Advance past the timeout
      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;

      expect(capturedSignal!.aborted).toBe(true);
      expect(result).toEqual({
        success: false,
        error: { status: 0, message: 'Could not connect to server' },
      });
    });
  });

  describe('sendReport — retries', () => {
    it('retries once on 5xx and succeeds on retry', async () => {
      let callCount = 0;

      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(
              new Response('Server Error', { status: 500 }),
            );
          }
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'retry-ok' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
        maxRetries: 1,
      });

      const promise = transport.sendReport(makeReport());
      // First attempt resolves immediately
      await vi.advanceTimersByTimeAsync(0);
      // Advance past the retry delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(callCount).toBe(2);
      expect(result).toEqual({
        success: true,
        reportId: 'retry-ok',
      });
    });

    it('returns error after retry exhaustion on 5xx', async () => {
      let callCount = 0;

      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          callCount++;
          return Promise.resolve(new Response('Server Error', { status: 502 }));
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
        maxRetries: 1,
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(callCount).toBe(2);
      expect(result).toEqual({
        success: false,
        error: { status: 502, message: 'Server error, try again later' },
      });
    });

    it('does not retry on 4xx errors', async () => {
      let callCount = 0;

      vi.stubGlobal(
        'fetch',
        vi.fn(() => {
          callCount++;
          return Promise.resolve(new Response('Bad', { status: 400 }));
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
        maxRetries: 1,
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;

      expect(callCount).toBe(1);
      expect(result.success).toBe(false);
      expect(result.error!.status).toBe(400);
    });
  });

  describe('sendReport — error mapping', () => {
    const errorCases = [
      { status: 400, message: 'Report could not be sent' },
      { status: 401, message: 'Authentication error' },
      { status: 403, message: 'Authentication error' },
      { status: 413, message: 'Report too large' },
      { status: 429, message: 'Too many reports, try again later' },
      { status: 500, message: 'Server error, try again later' },
      { status: 503, message: 'Server error, try again later' },
    ];

    for (const { status, message } of errorCases) {
      it(`maps ${status} to "${message}"`, async () => {
        vi.stubGlobal(
          'fetch',
          vi.fn(() => Promise.resolve(new Response('Error', { status }))),
        );

        const transport = createTransport({
          endpoint: 'https://api.test.com',
          auth: { type: 'none' },
          maxRetries: 0,
        });

        const promise = transport.sendReport(makeReport());
        await vi.advanceTimersByTimeAsync(0);

        const result = await promise;

        expect(result).toEqual({
          success: false,
          error: { status, message },
        });
      });
    }
  });

  describe('sendReport — attachments', () => {
    it('includes attachment files in FormData', async () => {
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-attach' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const file1 = new File(['content1'], 'log.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'error.json', {
        type: 'application/json',
      });

      const attachments = [
        {
          id: 'a1',
          file: file1,
          name: 'log.txt',
          size: 8,
          type: 'text/plain',
        },
        {
          id: 'a2',
          file: file2,
          name: 'error.json',
          size: 8,
          type: 'application/json',
        },
      ];

      const promise = transport.sendReport(
        makeReport(),
        undefined,
        attachments,
      );
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      const allAttachments = capturedBody!.getAll('attachments');
      expect(allAttachments).toHaveLength(2);
      expect(allAttachments[0]).toBeInstanceOf(File);
      expect(allAttachments[1]).toBeInstanceOf(File);
    });

    it('does not include attachments field when no attachments', async () => {
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-no-attach' }), {
              status: 201,
            }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedBody!.getAll('attachments')).toHaveLength(0);
    });

    it('does not include attachments field when empty array', async () => {
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-empty' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const promise = transport.sendReport(makeReport(), undefined, []);
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedBody!.getAll('attachments')).toHaveLength(0);
    });

    it('sends both screenshot and attachments', async () => {
      let capturedBody: FormData | undefined;

      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => {
          capturedBody = init.body as FormData;
          return Promise.resolve(
            new Response(JSON.stringify({ id: 'r-both' }), { status: 201 }),
          );
        }),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
      });

      const screenshot = new Blob(['img'], { type: 'image/jpeg' });
      const file = new File(['data'], 'data.csv', { type: 'text/csv' });
      const attachments = [
        {
          id: 'a1',
          file,
          name: 'data.csv',
          size: 4,
          type: 'text/csv',
        },
      ];

      const promise = transport.sendReport(
        makeReport(),
        screenshot,
        attachments,
      );
      await vi.advanceTimersByTimeAsync(0);
      await promise;

      expect(capturedBody!.get('screenshot')).toBeInstanceOf(File);
      expect(capturedBody!.getAll('attachments')).toHaveLength(1);
      expect(capturedBody!.get('report')).toBeTruthy();
    });
  });

  describe('sendReport — network errors', () => {
    it('handles network failure gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
      );

      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: { type: 'none' },
        maxRetries: 0,
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;

      expect(result).toEqual({
        success: false,
        error: { status: 0, message: 'Could not connect to server' },
      });
    });

    it('handles auth handler failure', async () => {
      const transport = createTransport({
        endpoint: 'https://api.test.com',
        auth: {
          type: 'custom',
          handler: () => {
            throw new Error('Auth provider down');
          },
        },
      });

      const promise = transport.sendReport(makeReport());
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;

      expect(result).toEqual({
        success: false,
        error: { status: 0, message: 'Authentication error' },
      });
    });
  });
});
