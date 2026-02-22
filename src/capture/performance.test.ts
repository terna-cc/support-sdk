import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPerformanceCapture } from './performance';

// ─── Mock PerformanceObserver ───────────────────────────────────────

type ObserverCallback = (list: { getEntries: () => unknown[] }) => void;

interface MockObserver {
  callback: ObserverCallback;
  type: string;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

let mockObservers: MockObserver[] = [];
let observeError: string | null = null;

class MockPerformanceObserver {
  callback: ObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    this.disconnect = vi.fn();
    this.observe = vi.fn((options: { type: string }) => {
      if (observeError === options.type) {
        throw new Error(`${options.type} not supported`);
      }
      const entry: MockObserver = {
        callback,
        type: options.type,
        observe: this.observe,
        disconnect: this.disconnect,
      };
      mockObservers.push(entry);
    });
  }
}

function triggerObserver(type: string, entries: unknown[]): void {
  for (const observer of mockObservers) {
    if (observer.type === type) {
      observer.callback({ getEntries: () => entries });
    }
  }
}

// ─── Setup ──────────────────────────────────────────────────────────

const originalPerformanceObserver = globalThis.PerformanceObserver;
const originalGetEntriesByType = performance.getEntriesByType;

beforeEach(() => {
  mockObservers = [];
  observeError = null;
  globalThis.PerformanceObserver =
    MockPerformanceObserver as unknown as typeof PerformanceObserver;
  performance.getEntriesByType = vi.fn(() => []);
});

afterEach(() => {
  globalThis.PerformanceObserver = originalPerformanceObserver;
  performance.getEntriesByType = originalGetEntriesByType;
  // Clean up performance.memory mock if set
  delete (performance as unknown as Record<string, unknown>).memory;
});

// ─── Tests ──────────────────────────────────────────────────────────

describe('createPerformanceCapture', () => {
  describe('Core Web Vitals', () => {
    it('captures LCP from largest-contentful-paint observer', () => {
      const capture = createPerformanceCapture();

      triggerObserver('largest-contentful-paint', [
        { startTime: 1200 },
        { startTime: 2500 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.lcp).toBe(2500);
      capture.destroy();
    });

    it('captures FID from first-input observer', () => {
      const capture = createPerformanceCapture();

      triggerObserver('first-input', [
        { startTime: 100, processingStart: 116 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.fid).toBe(16);
      capture.destroy();
    });

    it('captures CLS from layout-shift observer', () => {
      const capture = createPerformanceCapture();

      triggerObserver('layout-shift', [
        { hadRecentInput: false, value: 0.1 },
        { hadRecentInput: false, value: 0.05 },
        { hadRecentInput: true, value: 0.5 }, // Should be ignored
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.cls).toBeCloseTo(0.15);
      capture.destroy();
    });

    it('ignores layout shifts with recent input', () => {
      const capture = createPerformanceCapture();

      triggerObserver('layout-shift', [{ hadRecentInput: true, value: 0.3 }]);

      const metrics = capture.getMetrics();
      // CLS stays null because no qualifying shifts were recorded in this batch
      // Actually, the observer callback sets cls = clsValue (0) when shifts are
      // processed but none qualify. But the initial value is null and this batch
      // had no qualifying shift, so cls would NOT be set at all since the observer
      // callback skips non-qualifying entries but still sets cls = clsValue = 0.
      // Let's verify:
      expect(metrics.cls).toBe(0);
      capture.destroy();
    });

    it('captures INP from event observer', () => {
      const capture = createPerformanceCapture();

      triggerObserver('event', [
        { duration: 50 },
        { duration: 200 },
        { duration: 100 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.inp).toBe(200);
      capture.destroy();
    });

    it('captures TTFB from navigation timing', () => {
      performance.getEntriesByType = vi.fn(() => [
        { responseStart: 250, requestStart: 50 },
      ]);

      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();
      expect(metrics.ttfb).toBe(200);
      capture.destroy();
    });
  });

  describe('Long tasks', () => {
    it('captures long tasks above default threshold (50ms)', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000);

      const capture = createPerformanceCapture();

      triggerObserver('longtask', [
        { duration: 80, startTime: 500 },
        { duration: 120, startTime: 600 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.longTasks).toHaveLength(2);
      expect(metrics.longTasks[0]).toEqual({
        duration: 80,
        startTime: 500,
        timestamp: 1000,
      });
      expect(metrics.longTasks[1]).toEqual({
        duration: 120,
        startTime: 600,
        timestamp: 1000,
      });

      vi.restoreAllMocks();
      capture.destroy();
    });

    it('filters tasks below configured threshold', () => {
      const capture = createPerformanceCapture({ longTaskThreshold: 100 });

      triggerObserver('longtask', [
        { duration: 60, startTime: 100 },
        { duration: 150, startTime: 200 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.longTasks).toHaveLength(1);
      expect(metrics.longTasks[0].duration).toBe(150);
      capture.destroy();
    });

    it('caps long tasks at maxLongTasks using RingBuffer', () => {
      const capture = createPerformanceCapture({ maxLongTasks: 2 });

      triggerObserver('longtask', [
        { duration: 60, startTime: 100 },
        { duration: 70, startTime: 200 },
        { duration: 80, startTime: 300 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.longTasks).toHaveLength(2);
      // RingBuffer evicts oldest — should have the last two
      expect(metrics.longTasks[0].duration).toBe(70);
      expect(metrics.longTasks[1].duration).toBe(80);
      capture.destroy();
    });
  });

  describe('Memory', () => {
    it('captures memory info when available', () => {
      (performance as unknown as Record<string, unknown>).memory = {
        jsHeapSizeLimit: 2000000000,
        totalJSHeapSize: 500000000,
        usedJSHeapSize: 300000000,
      };

      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();

      expect(metrics.memory).toEqual({
        jsHeapSizeLimit: 2000000000,
        totalJSHeapSize: 500000000,
        usedJSHeapSize: 300000000,
      });
      capture.destroy();
    });

    it('returns null for memory when not available', () => {
      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();
      expect(metrics.memory).toBeNull();
      capture.destroy();
    });
  });

  describe('Graceful degradation', () => {
    it('returns null for all metrics when PerformanceObserver is not available', () => {
      // Remove PerformanceObserver
      delete (globalThis as Record<string, unknown>).PerformanceObserver;

      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();

      expect(metrics.lcp).toBeNull();
      expect(metrics.fid).toBeNull();
      expect(metrics.cls).toBeNull();
      expect(metrics.inp).toBeNull();
      expect(metrics.longTasks).toEqual([]);
      expect(metrics.memory).toBeNull();
      capture.destroy();
    });

    it('returns null for unsupported observer types', () => {
      // Simulate browser that doesn't support layout-shift
      observeError = 'layout-shift';

      const capture = createPerformanceCapture();

      // Other observers should still work
      triggerObserver('largest-contentful-paint', [{ startTime: 1500 }]);

      const metrics = capture.getMetrics();
      expect(metrics.lcp).toBe(1500);
      expect(metrics.cls).toBeNull();
      capture.destroy();
    });

    it('handles performance.getEntriesByType throwing', () => {
      performance.getEntriesByType = vi.fn(() => {
        throw new Error('Not supported');
      });

      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();
      expect(metrics.ttfb).toBeNull();
      capture.destroy();
    });

    it('returns null for TTFB when no navigation entries exist', () => {
      performance.getEntriesByType = vi.fn(() => []);

      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();
      expect(metrics.ttfb).toBeNull();
      capture.destroy();
    });
  });

  describe('Default metrics', () => {
    it('returns all nulls and empty arrays initially', () => {
      const capture = createPerformanceCapture();
      const metrics = capture.getMetrics();

      expect(metrics.lcp).toBeNull();
      expect(metrics.fid).toBeNull();
      expect(metrics.cls).toBeNull();
      expect(metrics.inp).toBeNull();
      expect(metrics.ttfb).toBeNull();
      expect(metrics.longTasks).toEqual([]);
      expect(metrics.memory).toBeNull();
      capture.destroy();
    });
  });

  describe('clear()', () => {
    it('resets long task buffer', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000);

      const capture = createPerformanceCapture();

      triggerObserver('longtask', [
        { duration: 80, startTime: 500 },
        { duration: 120, startTime: 600 },
      ]);

      expect(capture.getMetrics().longTasks).toHaveLength(2);

      capture.clear();

      expect(capture.getMetrics().longTasks).toHaveLength(0);

      vi.restoreAllMocks();
      capture.destroy();
    });

    it('allows new long tasks to be captured after clear', () => {
      vi.spyOn(Date, 'now').mockReturnValue(2000);

      const capture = createPerformanceCapture();

      triggerObserver('longtask', [{ duration: 80, startTime: 500 }]);
      expect(capture.getMetrics().longTasks).toHaveLength(1);

      capture.clear();

      triggerObserver('longtask', [{ duration: 100, startTime: 700 }]);
      expect(capture.getMetrics().longTasks).toHaveLength(1);
      expect(capture.getMetrics().longTasks[0].duration).toBe(100);

      vi.restoreAllMocks();
      capture.destroy();
    });
  });

  describe('destroy()', () => {
    it('disconnects all observers', () => {
      const capture = createPerformanceCapture();

      // Should have created observers for LCP, FID, CLS, INP, long tasks
      const disconnects = mockObservers.map((o) => o.disconnect);
      expect(disconnects.length).toBeGreaterThan(0);

      capture.destroy();

      for (const disconnect of disconnects) {
        expect(disconnect).toHaveBeenCalled();
      }
    });

    it('can be called multiple times safely', () => {
      const capture = createPerformanceCapture();
      capture.destroy();
      capture.destroy(); // Should not throw
    });
  });

  describe('Configuration', () => {
    it('uses default threshold of 50ms', () => {
      const capture = createPerformanceCapture();

      triggerObserver('longtask', [
        { duration: 49, startTime: 100 },
        { duration: 50, startTime: 200 },
        { duration: 51, startTime: 300 },
      ]);

      const metrics = capture.getMetrics();
      expect(metrics.longTasks).toHaveLength(2);
      expect(metrics.longTasks[0].duration).toBe(50);
      expect(metrics.longTasks[1].duration).toBe(51);
      capture.destroy();
    });

    it('uses default maxLongTasks of 20', () => {
      const capture = createPerformanceCapture();

      const entries = Array.from({ length: 25 }, (_, i) => ({
        duration: 100 + i,
        startTime: i * 100,
      }));

      triggerObserver('longtask', entries);

      const metrics = capture.getMetrics();
      expect(metrics.longTasks).toHaveLength(20);
      // Should contain the last 20 (oldest evicted)
      expect(metrics.longTasks[0].duration).toBe(105);
      expect(metrics.longTasks[19].duration).toBe(124);
      capture.destroy();
    });

    it('accepts custom config', () => {
      const capture = createPerformanceCapture({
        longTaskThreshold: 100,
        maxLongTasks: 5,
      });

      const entries = Array.from({ length: 10 }, (_, i) => ({
        duration: 100 + i * 10,
        startTime: i * 100,
      }));

      triggerObserver('longtask', entries);

      const metrics = capture.getMetrics();
      expect(metrics.longTasks).toHaveLength(5);
      capture.destroy();
    });
  });

  describe('CLS accumulation', () => {
    it('accumulates CLS across multiple observer callbacks', () => {
      const capture = createPerformanceCapture();

      triggerObserver('layout-shift', [{ hadRecentInput: false, value: 0.1 }]);
      triggerObserver('layout-shift', [{ hadRecentInput: false, value: 0.05 }]);

      const metrics = capture.getMetrics();
      expect(metrics.cls).toBeCloseTo(0.15);
      capture.destroy();
    });
  });

  describe('INP tracking', () => {
    it('tracks the worst INP across multiple callbacks', () => {
      const capture = createPerformanceCapture();

      triggerObserver('event', [{ duration: 100 }]);
      triggerObserver('event', [{ duration: 300 }]);
      triggerObserver('event', [{ duration: 150 }]);

      const metrics = capture.getMetrics();
      expect(metrics.inp).toBe(300);
      capture.destroy();
    });
  });

  describe('LCP updates', () => {
    it('takes the last LCP entry (most recent)', () => {
      const capture = createPerformanceCapture();

      triggerObserver('largest-contentful-paint', [{ startTime: 1000 }]);
      triggerObserver('largest-contentful-paint', [{ startTime: 2500 }]);

      const metrics = capture.getMetrics();
      expect(metrics.lcp).toBe(2500);
      capture.destroy();
    });
  });
});
