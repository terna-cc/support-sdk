import { RingBuffer } from '../core/ring-buffer';
import type {
  PerformanceMetrics,
  LongTaskEntry,
  MemoryInfo,
  PerformanceCaptureConfig,
} from '../types';

// ─── Public interface ───────────────────────────────────────────────

export interface PerformanceCapture {
  getMetrics(): PerformanceMetrics;
  destroy(): void;
}

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULT_LONG_TASK_THRESHOLD = 50;
const DEFAULT_MAX_LONG_TASKS = 20;

// ─── Factory ────────────────────────────────────────────────────────

export function createPerformanceCapture(
  config?: PerformanceCaptureConfig,
): PerformanceCapture {
  const threshold = config?.longTaskThreshold ?? DEFAULT_LONG_TASK_THRESHOLD;
  const maxLongTasks = config?.maxLongTasks ?? DEFAULT_MAX_LONG_TASKS;

  let lcp: number | null = null;
  let fid: number | null = null;
  let cls: number | null = null;
  let inp: number | null = null;
  let ttfb: number | null = null;

  const longTaskBuffer = new RingBuffer<LongTaskEntry>(maxLongTasks);
  const observers: PerformanceObserver[] = [];

  // ── TTFB (synchronous — no observer needed) ──
  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const nav = navEntries[0] as PerformanceNavigationTiming;
      ttfb = nav.responseStart - nav.requestStart;
    }
  } catch {
    // performance.getEntriesByType not available
  }

  // ── LCP ──
  tryObserve('largest-contentful-paint', (list) => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      lcp = entries[entries.length - 1].startTime;
    }
  });

  // ── FID ──
  tryObserve('first-input', (list) => {
    const entries = list.getEntries();
    if (entries.length > 0) {
      const entry = entries[0] as PerformanceEventTiming;
      fid = entry.processingStart - entry.startTime;
    }
  });

  // ── CLS ──
  let clsValue = 0;
  tryObserve('layout-shift', (list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      };
      if (!shift.hadRecentInput) {
        clsValue += shift.value;
      }
    }
    cls = clsValue;
  });

  // ── INP ──
  tryObserve(
    'event',
    (list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration;
        if (inp === null || duration > inp) {
          inp = duration;
        }
      }
    },
    { durationThreshold: 16 },
  );

  // ── Long Tasks ──
  tryObserve('longtask', (list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration >= threshold) {
        longTaskBuffer.push({
          duration: entry.duration,
          startTime: entry.startTime,
          timestamp: Date.now(),
        });
      }
    }
  });

  function tryObserve(
    type: string,
    callback: (list: PerformanceObserverEntryList) => void,
    extraOptions?: Record<string, unknown>,
  ): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver(callback);
      const options: PerformanceObserverInit = {
        type,
        buffered: true,
        ...extraOptions,
      };
      observer.observe(options);
      observers.push(observer);
    } catch {
      // Browser doesn't support this entry type
    }
  }

  function getMemory(): MemoryInfo | null {
    const perf = performance as unknown as {
      memory?: {
        jsHeapSizeLimit: number;
        totalJSHeapSize: number;
        usedJSHeapSize: number;
      };
    };
    if (!perf.memory) return null;
    return {
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      usedJSHeapSize: perf.memory.usedJSHeapSize,
    };
  }

  function getMetrics(): PerformanceMetrics {
    return {
      lcp,
      fid,
      cls,
      inp,
      ttfb,
      longTasks: longTaskBuffer.getAll(),
      memory: getMemory(),
    };
  }

  function destroy(): void {
    for (const observer of observers) {
      observer.disconnect();
    }
    observers.length = 0;
  }

  return { getMetrics, destroy };
}
