import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createErrorCapture } from './errors';

describe('createErrorCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('catches window error events', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    const errorEvent = new ErrorEvent('error', {
      message: 'Test error',
      filename: 'test.js',
      lineno: 42,
      colno: 10,
      error: new Error('Test error'),
    });

    window.dispatchEvent(errorEvent);

    expect(onError).toHaveBeenCalledTimes(1);
    const errorInfo = onError.mock.calls[0][0];
    expect(errorInfo.message).toBe('Test error');
    expect(errorInfo.source).toBe('test.js');
    expect(errorInfo.line).toBe(42);
    expect(errorInfo.column).toBe(10);
    expect(errorInfo.type).toBe('error');
    expect(errorInfo.stack).toBeDefined();
    expect(errorInfo.timestamp).toBeTypeOf('number');

    capture.stop();
  });

  it('catches unhandledrejection events', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    const error = new Error('Promise failed');
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: error,
    });

    window.dispatchEvent(event);

    expect(onError).toHaveBeenCalledTimes(1);
    const errorInfo = onError.mock.calls[0][0];
    expect(errorInfo.message).toBe('Promise failed');
    expect(errorInfo.type).toBe('unhandledrejection');
    expect(errorInfo.stack).toBeDefined();
    expect(errorInfo.timestamp).toBeTypeOf('number');

    capture.stop();
  });

  it('handles unhandledrejection with string reason', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: 'string rejection',
    });

    window.dispatchEvent(event);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('string rejection');

    capture.stop();
  });

  it('handles unhandledrejection with non-error, non-string reason', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: { code: 500 },
    });

    window.dispatchEvent(event);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe(
      'Unhandled promise rejection',
    );

    capture.stop();
  });

  it('ErrorInfo has correct shape', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    const errorEvent = new ErrorEvent('error', {
      message: 'Shape test',
      filename: 'shape.ts',
      lineno: 1,
      colno: 2,
      error: new Error('Shape test'),
    });

    window.dispatchEvent(errorEvent);

    const info = onError.mock.calls[0][0];
    expect(info).toHaveProperty('message');
    expect(info).toHaveProperty('type');
    expect(info).toHaveProperty('timestamp');
    expect(info).toHaveProperty('stack');
    expect(info).toHaveProperty('source');
    expect(info).toHaveProperty('line');
    expect(info).toHaveProperty('column');

    capture.stop();
  });

  it('stop() removes listeners', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);
    capture.stop();

    // Add a temporary handler to prevent the error from being treated
    // as an unhandled exception by the test runner
    const swallow = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', swallow);

    const errorEvent = new ErrorEvent('error', {
      message: 'After stop',
      error: new Error('After stop'),
      cancelable: true,
    });

    window.dispatchEvent(errorEvent);

    expect(onError).not.toHaveBeenCalled();

    window.removeEventListener('error', swallow);
  });

  it('debounces errors within 1s of each other', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    // First error — should fire
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Error 1',
        error: new Error('Error 1'),
      }),
    );

    expect(onError).toHaveBeenCalledTimes(1);

    // Advance 500ms — within debounce window
    vi.advanceTimersByTime(500);

    // Second error — should be debounced
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Error 2',
        error: new Error('Error 2'),
      }),
    );

    expect(onError).toHaveBeenCalledTimes(1);

    // Advance another 600ms (total 1100ms since first error) — past debounce window
    vi.advanceTimersByTime(600);

    // Third error — should fire
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Error 3',
        error: new Error('Error 3'),
      }),
    );

    expect(onError).toHaveBeenCalledTimes(2);

    capture.stop();
  });

  it('debounces across error types (error + rejection)', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    // First: window error
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Error',
        error: new Error('Error'),
      }),
    );

    expect(onError).toHaveBeenCalledTimes(1);

    // Within 1s: unhandled rejection — should be debounced
    vi.advanceTimersByTime(200);

    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.resolve(),
        reason: new Error('Rejection'),
      }),
    );

    expect(onError).toHaveBeenCalledTimes(1);

    capture.stop();
  });

  it('handles error event without error object', () => {
    const capture = createErrorCapture();
    const onError = vi.fn();
    capture.start(onError);

    const errorEvent = new ErrorEvent('error', {
      message: 'Script error',
    });

    window.dispatchEvent(errorEvent);

    expect(onError).toHaveBeenCalledTimes(1);
    const info = onError.mock.calls[0][0];
    expect(info.message).toBe('Script error');
    expect(info.stack).toBeUndefined();

    capture.stop();
  });
});
