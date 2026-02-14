import { RingBuffer } from '../core/ring-buffer';
import { Sanitizer } from '../core/sanitizer';
import type { ConsoleEntry, ConsoleLevel } from '../types';

export interface ConsoleCapture {
  start(): void;
  stop(): void;
  getEntries(): ConsoleEntry[];
  freeze(): ConsoleEntry[];
  clear(): void;
}

const LEVELS: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function createConsoleCapture(
  sanitizer: Sanitizer,
  bufferSize: number,
): ConsoleCapture {
  const buffer = new RingBuffer<ConsoleEntry>(bufferSize);
  const originals = new Map<ConsoleLevel, (...args: unknown[]) => void>();
  let active = false;

  function start(): void {
    if (active) return;
    active = true;

    for (const level of LEVELS) {
      originals.set(level, console[level] as (...args: unknown[]) => void);

      (console as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
        const original = originals.get(level)!;
        original.apply(console, args);

        const message = sanitizer.sanitizeString(stringify(args[0] ?? ''));
        const rest = args.slice(1).map((a) => sanitizer.sanitizeString(stringify(a)));

        const entry: ConsoleEntry = {
          level,
          message,
          args: rest,
          timestamp: Date.now(),
        };

        if (level === 'error') {
          const stack = new Error().stack;
          if (stack) {
            entry.args = [...rest, sanitizer.sanitizeString(stack)];
          }
        }

        buffer.push(entry);
      };
    }
  }

  function stop(): void {
    if (!active) return;
    active = false;

    for (const level of LEVELS) {
      const original = originals.get(level);
      if (original) {
        (console as unknown as Record<string, unknown>)[level] = original;
      }
    }
    originals.clear();
  }

  function getEntries(): ConsoleEntry[] {
    return buffer.getAll();
  }

  function freeze(): ConsoleEntry[] {
    return buffer.freeze();
  }

  function clear(): void {
    buffer.clear();
  }

  return { start, stop, getEntries, freeze, clear };
}
