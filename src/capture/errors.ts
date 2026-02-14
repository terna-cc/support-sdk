import type { ErrorInfo } from '../types';

export interface ErrorCapture {
  start(onError: (errorInfo: ErrorInfo) => void): void;
  stop(): void;
}

const DEBOUNCE_MS = 1000;

export function createErrorCapture(): ErrorCapture {
  let active = false;
  let errorHandler: ((event: ErrorEvent) => void) | null = null;
  let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
  let lastErrorTime = 0;

  function shouldDebounce(): boolean {
    const now = Date.now();
    if (now - lastErrorTime < DEBOUNCE_MS) {
      return true;
    }
    lastErrorTime = now;
    return false;
  }

  function start(onError: (errorInfo: ErrorInfo) => void): void {
    if (active) return;
    active = true;

    errorHandler = (event: ErrorEvent) => {
      if (shouldDebounce()) return;

      const errorInfo: ErrorInfo = {
        message: event.message || 'Unknown error',
        stack: event.error?.stack ?? undefined,
        source: event.filename ?? undefined,
        line: event.lineno ?? undefined,
        column: event.colno ?? undefined,
        type: 'error',
        timestamp: Date.now(),
      };

      onError(errorInfo);
    };

    rejectionHandler = (event: PromiseRejectionEvent) => {
      if (shouldDebounce()) return;

      const reason = event.reason;
      let message = 'Unhandled promise rejection';
      let stack: string | undefined;

      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      }

      const errorInfo: ErrorInfo = {
        message,
        stack,
        type: 'unhandledrejection',
        timestamp: Date.now(),
      };

      onError(errorInfo);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
  }

  function stop(): void {
    if (!active) return;
    active = false;

    if (errorHandler) {
      window.removeEventListener('error', errorHandler);
      errorHandler = null;
    }

    if (rejectionHandler) {
      window.removeEventListener('unhandledrejection', rejectionHandler);
      rejectionHandler = null;
    }
  }

  return { start, stop };
}
