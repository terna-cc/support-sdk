import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConsoleCapture } from './console';
import { Sanitizer } from '../core/sanitizer';
import type { ConsoleLevel } from '../types';

describe('createConsoleCapture', () => {
  let sanitizer: Sanitizer;
  const originals: Record<string, unknown> = {};

  beforeEach(() => {
    sanitizer = new Sanitizer();
    // Save originals before each test
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      originals[level] = console[level];
    }
  });

  afterEach(() => {
    // Restore originals after each test (safety net)
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      (console as Record<string, unknown>)[level] = originals[level];
    }
  });

  it('intercepts all 5 log levels', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.log('log message');
    console.info('info message');
    console.warn('warn message');
    console.error('error message');
    console.debug('debug message');

    const entries = capture.getEntries();
    expect(entries).toHaveLength(5);

    const levels = entries.map((e) => e.level);
    expect(levels).toEqual(['log', 'info', 'warn', 'error', 'debug']);

    capture.stop();
  });

  it('calls original console methods', () => {
    const spies: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      spies[level] = vi.fn();
      (console as Record<string, unknown>)[level] = spies[level];
    }

    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.log('test');
    console.info('test');
    console.warn('test');
    console.error('test');
    console.debug('test');

    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      expect(spies[level]).toHaveBeenCalledWith('test');
    }

    capture.stop();
  });

  it('stores entries with correct shape', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    const before = Date.now();
    console.log('hello', 'world', 42);
    const after = Date.now();

    const entries = capture.getEntries();
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.level).toBe('log');
    expect(entry.message).toBe('hello');
    expect(entry.args).toEqual(['world', '42']);
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);

    capture.stop();
  });

  it('sanitizes message and args', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.log(
      'email: user@example.com',
      'token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig',
    );

    const entries = capture.getEntries();
    expect(entries[0].message).toContain('[REDACTED:email]');
    expect(entries[0].args[0]).toContain('[REDACTED:jwt]');

    capture.stop();
  });

  it('stop() restores original console methods', () => {
    const originalLog = console.log;
    const capture = createConsoleCapture(sanitizer, 50);

    capture.start();
    expect(console.log).not.toBe(originalLog);

    capture.stop();
    expect(console.log).toBe(originalLog);
  });

  it('respects buffer capacity limit', () => {
    const capture = createConsoleCapture(sanitizer, 3);
    capture.start();

    console.log('one');
    console.log('two');
    console.log('three');
    console.log('four');

    const entries = capture.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0].message).toBe('two');
    expect(entries[2].message).toBe('four');

    capture.stop();
  });

  it('freeze() returns a copy that does not change', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.log('before freeze');
    const frozen = capture.freeze();

    console.log('after freeze');
    expect(frozen).toHaveLength(1);
    expect(frozen[0].message).toBe('before freeze');

    expect(capture.getEntries()).toHaveLength(2);

    capture.stop();
  });

  it('clear() empties the buffer', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.log('test');
    expect(capture.getEntries()).toHaveLength(1);

    capture.clear();
    expect(capture.getEntries()).toHaveLength(0);

    capture.stop();
  });

  it('captures stack trace for console.error', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.error('something failed');

    const entries = capture.getEntries();
    const errorEntry = entries[0];
    expect(errorEntry.level).toBe('error');
    // The last arg should be a stack trace string
    const lastArg = errorEntry.args[errorEntry.args.length - 1];
    expect(lastArg).toContain('Error');

    capture.stop();
  });

  it('handles non-string arguments (objects, numbers)', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();

    console.log({ key: 'value' }, 123, true);

    const entries = capture.getEntries();
    expect(entries[0].message).toBe('{"key":"value"}');
    expect(entries[0].args).toEqual(['123', 'true']);

    capture.stop();
  });

  it('does not capture entries when not started', () => {
    const capture = createConsoleCapture(sanitizer, 50);

    console.log('not captured');

    expect(capture.getEntries()).toHaveLength(0);
  });

  it('does not capture entries after stop', () => {
    const capture = createConsoleCapture(sanitizer, 50);
    capture.start();
    console.log('captured');
    capture.stop();
    console.log('not captured');

    expect(capture.getEntries()).toHaveLength(1);
    expect(capture.getEntries()[0].message).toBe('captured');
  });
});
