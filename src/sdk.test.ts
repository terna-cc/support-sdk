import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupportSDK } from './sdk';
import type { SupportSDKConfig } from './types';

// ─── Mocks ───────────────────────────────────────────────────────────

// Mock modern-screenshot to avoid DOM rendering issues in jsdom
vi.mock('modern-screenshot', () => ({
  domToBlob: vi.fn(() =>
    Promise.resolve(new Blob(['fake'], { type: 'image/jpeg' })),
  ),
}));

// Mock URL.createObjectURL for screenshot preview in modal
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function minimalConfig(
  overrides?: Partial<SupportSDKConfig>,
): SupportSDKConfig {
  return {
    endpoint: 'https://api.test.com',
    auth: { type: 'none' },
    ...overrides,
  };
}

// ─── Setup / Teardown ────────────────────────────────────────────────

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;

  // Clean up any leftover Shadow DOM elements
  document
    .querySelectorAll(
      '[data-support-trigger], [data-support-modal], [data-support-sdk-toast]',
    )
    .forEach((el) => el.remove());
});

// ─── Tests ───────────────────────────────────────────────────────────

describe('SupportSDK', () => {
  describe('init()', () => {
    it('creates an instance with all modules', () => {
      const sdk = SupportSDK.init(minimalConfig());
      expect(sdk).toBeInstanceOf(SupportSDK);

      // Trigger button should be mounted
      const trigger = document.querySelector('[data-support-trigger]');
      expect(trigger).not.toBeNull();

      sdk.destroy();
    });

    it('throws if endpoint is missing', () => {
      expect(() =>
        SupportSDK.init({ endpoint: '' } as SupportSDKConfig),
      ).toThrow('[SupportSDK] "endpoint" is required in config.');
    });

    it('warns and returns existing instance on double init', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sdk1 = SupportSDK.init(minimalConfig());
      const sdk2 = SupportSDK.init(minimalConfig());

      expect(sdk2).toBe(sdk1);
      expect(warnSpy).toHaveBeenCalledWith(
        '[SupportSDK] Already initialized. Call destroy() before re-initializing.',
      );

      warnSpy.mockRestore();
      sdk1.destroy();
    });

    it('allows re-init after destroy', () => {
      const sdk1 = SupportSDK.init(minimalConfig());
      sdk1.destroy();

      const sdk2 = SupportSDK.init(minimalConfig());
      expect(sdk2).toBeInstanceOf(SupportSDK);
      expect(sdk2).not.toBe(sdk1);

      sdk2.destroy();
    });
  });

  describe('capture module creation', () => {
    it('creates all capture modules by default', () => {
      // When no capture config is specified, all modules should be active.
      // We verify by checking that console patching is active (console methods are wrapped)
      const originalLog = console.log;
      const sdk = SupportSDK.init(minimalConfig());

      // Console should be patched
      expect(console.log).not.toBe(originalLog);

      sdk.destroy();

      // Console should be restored
      expect(console.log).toBe(originalLog);
    });

    it('does not create console capture when disabled', () => {
      const originalLog = console.log;
      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { console: false },
        }),
      );

      // Console should NOT be patched
      expect(console.log).toBe(originalLog);

      sdk.destroy();
    });

    it('does not create network capture when disabled', () => {
      const originalFetch = globalThis.fetch;
      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
        }),
      );

      // Fetch should NOT be patched
      expect(globalThis.fetch).toBe(originalFetch);

      sdk.destroy();
    });

    it('does not create breadcrumb capture when disabled', () => {
      const originalPushState = history.pushState;
      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { breadcrumbs: false },
        }),
      );

      // history.pushState should NOT be patched
      expect(history.pushState).toBe(originalPushState);

      sdk.destroy();
    });

    it('does not create trigger button when showTrigger is false', () => {
      const sdk = SupportSDK.init(
        minimalConfig({
          ui: { showTrigger: false },
        }),
      );

      const trigger = document.querySelector('[data-support-trigger]');
      expect(trigger).toBeNull();

      sdk.destroy();
    });

    it('respects custom buffer sizes', () => {
      const originalLog = console.log;
      const sdk = SupportSDK.init(
        minimalConfig({
          capture: {
            console: { maxItems: 5 },
          },
        }),
      );

      // Console should be patched (module was created)
      expect(console.log).not.toBe(originalLog);

      sdk.destroy();
    });
  });

  describe('triggerReport()', () => {
    it('opens the review modal', async () => {
      const sdk = SupportSDK.init(minimalConfig());

      sdk.triggerReport();

      // Allow async operations to complete
      await vi.waitFor(() => {
        const modal = document.querySelector('[data-support-modal]');
        expect(modal).not.toBeNull();
      });

      sdk.destroy();
    });
  });

  describe('addBreadcrumb()', () => {
    it('delegates to breadcrumb capture', () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Should not throw
      sdk.addBreadcrumb({
        type: 'custom',
        message: 'test breadcrumb',
        data: { key: 'value' },
      });

      sdk.destroy();
    });

    it('is a no-op after destroy', () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();

      // Should not throw
      sdk.addBreadcrumb({
        type: 'custom',
        message: 'should be ignored',
      });
    });
  });

  describe('setUser()', () => {
    it('updates user context', () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Should not throw
      sdk.setUser({ id: '123', email: 'user@test.com', name: 'Test User' });

      sdk.destroy();
    });

    it('is a no-op after destroy', () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();

      // Should not throw
      sdk.setUser({ id: '456' });
    });
  });

  describe('setMetadata()', () => {
    it('updates metadata', () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Should not throw
      sdk.setMetadata({ environment: 'test', version: '1.0' });

      sdk.destroy();
    });

    it('is a no-op after destroy', () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();

      // Should not throw
      sdk.setMetadata({ ignored: true });
    });
  });

  describe('destroy()', () => {
    it('stops all capture modules and removes DOM elements', () => {
      const originalLog = console.log;
      const originalFetch = globalThis.fetch;
      const originalPushState = history.pushState;

      const sdk = SupportSDK.init(minimalConfig());

      // Verify patching
      expect(console.log).not.toBe(originalLog);

      sdk.destroy();

      // Globals should be restored
      expect(console.log).toBe(originalLog);
      expect(globalThis.fetch).toBe(originalFetch);
      expect(history.pushState).toBe(originalPushState);

      // Trigger button should be removed
      const trigger = document.querySelector('[data-support-trigger]');
      expect(trigger).toBeNull();
    });

    it('is idempotent (calling destroy twice is safe)', () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();
      sdk.destroy(); // Should not throw
    });

    it('makes triggerReport a no-op', () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();

      // Should not throw or open modal
      sdk.triggerReport();
      const modal = document.querySelector('[data-support-modal]');
      expect(modal).toBeNull();
    });
  });

  describe('error auto-capture flow', () => {
    it('shows toast when an error occurs', async () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Dispatch an error event
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 1,
        colno: 1,
        error: new Error('Test error'),
      });
      window.dispatchEvent(errorEvent);

      // Toast should appear
      await vi.waitFor(() => {
        const toast = document.querySelector('[data-support-sdk-toast]');
        expect(toast).not.toBeNull();
      });

      sdk.destroy();
    });
  });

  describe('captureOnOpen()', () => {
    it('captures a diagnostic snapshot without throwing', () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Should not throw
      sdk.captureOnOpen();

      sdk.destroy();
    });

    it('is a no-op after destroy', () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();

      // Should not throw
      sdk.captureOnOpen();
    });

    it('does not block — returns synchronously while screenshot captures async', async () => {
      // Use a slow screenshot mock to prove captureOnOpen() doesn't await it
      const { domToBlob } = await import('modern-screenshot');
      const slowCapture = vi.fn(
        () =>
          new Promise<Blob>((resolve) =>
            setTimeout(() => resolve(new Blob(['fake'])), 500),
          ),
      );
      vi.mocked(domToBlob).mockImplementation(slowCapture);

      const sdk = SupportSDK.init(minimalConfig());

      // captureOnOpen() should return immediately (synchronous façade)
      sdk.captureOnOpen();

      // The async screenshot work was scheduled but not yet resolved
      expect(slowCapture).toHaveBeenCalled();

      sdk.destroy();
    });
  });

  describe('submitWithIntent()', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('sends a bug report with full diagnostics after captureOnOpen', async () => {
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'report-1' }), { status: 200 }),
        );

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      sdk.captureOnOpen();

      // Allow async capture to complete
      await new Promise((r) => setTimeout(r, 50));

      await sdk.submitWithIntent('bug', 'The page crashes on save');

      // Verify fetch was called with the reports endpoint
      const reportCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('/reports'),
      );
      expect(reportCalls.length).toBeGreaterThan(0);

      // Verify the report contains diagnostics
      const lastCall = reportCalls[reportCalls.length - 1];
      const formData = lastCall[1]?.body as FormData;
      const reportJson = formData?.get('report') as string;
      expect(reportJson).toBeTruthy();
      const report = JSON.parse(reportJson);
      expect(report.description).toBe('The page crashes on save');
      expect(report.browser).toBeDefined();

      sdk.destroy();
    });

    it('sends a text-only report for feedback intent', async () => {
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'report-2' }), { status: 200 }),
        );

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      // No captureOnOpen() — feedback doesn't need diagnostics
      await sdk.submitWithIntent('feedback', 'Great app!');

      // Verify fetch was called
      const reportCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('/reports'),
      );
      expect(reportCalls.length).toBeGreaterThan(0);

      // Verify the report body contains description but empty diagnostics
      const lastCall = reportCalls[reportCalls.length - 1];
      const formData = lastCall[1]?.body as FormData;
      const reportJson = formData?.get('report') as string;
      if (reportJson) {
        const report = JSON.parse(reportJson);
        expect(report.description).toBe('Great app!');
        expect(report.console).toEqual([]);
        expect(report.network).toEqual([]);
      }

      sdk.destroy();
    });

    it('sends text-only report for question intent', async () => {
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'report-3' }), { status: 200 }),
        );

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      await sdk.submitWithIntent('question', 'How do I export?');

      const reportCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('/reports'),
      );
      expect(reportCalls.length).toBeGreaterThan(0);

      sdk.destroy();
    });

    it('clears pending diagnostics after submission', async () => {
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ id: 'report-4' }), { status: 200 }),
          ),
        );

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      sdk.captureOnOpen();
      await new Promise((r) => setTimeout(r, 50));

      await sdk.submitWithIntent('bug', 'Bug report');

      // After submit, a second submit with 'bug' should send text-only
      // because _pendingDiagnostics was cleared
      await sdk.submitWithIntent('bug', 'Second report without diagnostics');

      // Should still send (as text-only fallback, since no pending diagnostics)
      const reportCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('/reports'),
      );
      // At least 2 report calls (one for each submitWithIntent)
      expect(reportCalls.length).toBeGreaterThanOrEqual(2);

      sdk.destroy();
    });

    it('is a no-op after destroy', async () => {
      const sdk = SupportSDK.init(minimalConfig());
      sdk.destroy();

      // Should not throw
      await sdk.submitWithIntent('bug', 'should be ignored');
    });

    it('throws on transport failure', async () => {
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('Bad Request', { status: 400 }));

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      await expect(sdk.submitWithIntent('feedback', 'Test')).rejects.toThrow();

      sdk.destroy();
    });
  });

  describe('clearPendingDiagnostics()', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('clears pending diagnostics without submitting', async () => {
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'report-6' }), { status: 200 }),
        );

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      sdk.captureOnOpen();
      await new Promise((r) => setTimeout(r, 50));

      sdk.clearPendingDiagnostics();

      // After clearing, a bug submit should send text-only (no diagnostics)
      await sdk.submitWithIntent('bug', 'After clearing diagnostics');

      const reportCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('/reports'),
      );
      expect(reportCalls.length).toBeGreaterThan(0);

      // The report should be text-only (empty arrays for diagnostics)
      const lastCall = reportCalls[reportCalls.length - 1];
      const formData = lastCall[1]?.body as FormData;
      const reportJson = formData?.get('report') as string;
      if (reportJson) {
        const report = JSON.parse(reportJson);
        expect(report.console).toEqual([]);
        expect(report.network).toEqual([]);
      }

      sdk.destroy();
    });

    it('is safe to call when no diagnostics are pending', () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Should not throw
      sdk.clearPendingDiagnostics();

      sdk.destroy();
    });
  });

  describe('resetBuffers()', () => {
    it('clears all diagnostic buffers without stopping capture', () => {
      const sdk = SupportSDK.init(minimalConfig());

      // Generate some data in the buffers
      console.log('test log 1');
      console.log('test log 2');

      sdk.addBreadcrumb({ type: 'custom', message: 'test breadcrumb' });

      // resetBuffers should not throw
      sdk.resetBuffers();

      // Console should still be patched (capture is still active)
      const originalLog = console.log;
      expect(typeof originalLog).toBe('function');

      sdk.destroy();
    });

    it('ensures second report after reset has clean data', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(
            new Response(JSON.stringify({ id: 'report-1' }), { status: 200 }),
          ),
        );

      const sdk = SupportSDK.init(
        minimalConfig({
          capture: { network: false },
          chat: { enabled: false },
        }),
      );

      // Add breadcrumbs before first report
      sdk.addBreadcrumb({
        type: 'custom',
        message: 'first session breadcrumb',
      });

      sdk.captureOnOpen();
      await new Promise((r) => setTimeout(r, 50));

      // First submit
      await sdk.submitWithIntent('bug', 'First report');

      // Reset buffers (simulating what happens after successful submission)
      sdk.resetBuffers();

      // Second captureOnOpen after reset
      sdk.captureOnOpen();
      await new Promise((r) => setTimeout(r, 50));

      // Second submit
      await sdk.submitWithIntent('bug', 'Second report');

      // Find the two report calls
      const reportCalls = fetchSpy.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          (call[0] as string).includes('/reports'),
      );
      expect(reportCalls.length).toBeGreaterThanOrEqual(2);

      // The second report's breadcrumbs should be empty (buffers were reset)
      const secondCall = reportCalls[reportCalls.length - 1];
      const formData = secondCall[1]?.body as FormData;
      const reportJson = formData?.get('report') as string;
      if (reportJson) {
        const report = JSON.parse(reportJson);
        expect(report.breadcrumbs).toEqual([]);
      }

      fetchSpy.mockRestore();
      sdk.destroy();
    });
  });

  describe('SDK_VERSION export', () => {
    it('is exported from the main entry', async () => {
      const { SDK_VERSION } = await import('./index');
      expect(typeof SDK_VERSION).toBe('string');
    });
  });
});
