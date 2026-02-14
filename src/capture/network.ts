import { RingBuffer } from '../core/ring-buffer';
import { Sanitizer } from '../core/sanitizer';
import type { NetworkEntry } from '../types';

export interface NetworkCapture {
  start(): void;
  stop(): void;
  getEntries(): NetworkEntry[];
  freeze(): NetworkEntry[];
  clear(): void;
}

const DEFAULT_MAX_BODY_SIZE = 10_000;

function isTextContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false;
  return contentType.includes('application/json') || contentType.includes('text/plain');
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

function extractBodyString(
  body: BodyInit | null | undefined,
  maxBodySize: number,
): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string') {
    if (body.length > maxBodySize) {
      return `[truncated, ${body.length} bytes total]`;
    }
    return body;
  }
  // For other types (Blob, ArrayBuffer, FormData, etc.), skip
  return null;
}

export function createNetworkCapture(
  sanitizer: Sanitizer,
  bufferSize: number,
  maxBodySize: number = DEFAULT_MAX_BODY_SIZE,
): NetworkCapture {
  const buffer = new RingBuffer<NetworkEntry>(bufferSize);
  let active = false;

  let originalFetch: typeof globalThis.fetch | null = null;
  let originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
  let originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
  let originalXHRSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;

  // URL to exclude (the SDK's own endpoint)
  let excludedEndpoint: string | null = null;

  function setExcludedEndpoint(endpoint: string): void {
    excludedEndpoint = endpoint;
  }

  function shouldExclude(url: string): boolean {
    if (!excludedEndpoint) return false;
    return url.startsWith(excludedEndpoint);
  }

  function startFetchInterception(): void {
    originalFetch = globalThis.fetch;

    globalThis.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const method = (init?.method ?? 'GET').toUpperCase();
      let url: string;

      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
      }

      if (shouldExclude(url)) {
        return originalFetch!.call(globalThis, input, init);
      }

      const sanitizedUrl = sanitizer.sanitizeUrl(url);

      // Extract request headers
      let reqHeaders: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          reqHeaders = headersToRecord(init.headers);
        } else if (Array.isArray(init.headers)) {
          for (const [key, value] of init.headers) {
            reqHeaders[key] = value;
          }
        } else {
          reqHeaders = { ...(init.headers as Record<string, string>) };
        }
      }
      const sanitizedReqHeaders = sanitizer.sanitizeHeaders(reqHeaders);

      // Extract request body
      let requestBody: string | null = null;
      const reqContentType = reqHeaders['content-type'] ?? reqHeaders['Content-Type'] ?? '';
      if (isTextContentType(reqContentType)) {
        requestBody = extractBodyString(init?.body, maxBodySize);
        if (requestBody) {
          requestBody = sanitizer.sanitizeString(requestBody);
        }
      }

      const startTime = performance.now();

      try {
        const response = await originalFetch!.call(globalThis, input, init);
        const duration = Math.round(performance.now() - startTime);

        // Extract response headers
        const resHeaders = headersToRecord(response.headers);
        const sanitizedResHeaders = sanitizer.sanitizeHeaders(resHeaders);

        // Extract response body
        let responseBody: string | null = null;
        const resContentType = response.headers.get('content-type');
        if (isTextContentType(resContentType)) {
          try {
            const cloned = response.clone();
            const text = await cloned.text();
            if (text.length > maxBodySize) {
              responseBody = `[truncated, ${text.length} bytes total]`;
            } else {
              responseBody = sanitizer.sanitizeString(text);
            }
          } catch {
            responseBody = null;
          }
        } else if (resContentType) {
          // Binary content — record size hint
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            responseBody = `[binary, ${contentLength} bytes]`;
          } else {
            responseBody = '[binary]';
          }
        }

        const entry: NetworkEntry = {
          method,
          url: sanitizedUrl,
          status: response.status,
          requestHeaders: sanitizedReqHeaders,
          responseHeaders: sanitizedResHeaders,
          requestBody,
          responseBody,
          duration,
          timestamp: Date.now(),
        };

        buffer.push(entry);
        return response;
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);

        const entry: NetworkEntry = {
          method,
          url: sanitizedUrl,
          status: null,
          requestHeaders: sanitizedReqHeaders,
          responseHeaders: {},
          requestBody,
          responseBody: null,
          duration,
          timestamp: Date.now(),
        };

        buffer.push(entry);
        throw error;
      }
    };
  }

  function startXHRInterception(): void {
    originalXHROpen = XMLHttpRequest.prototype.open;
    originalXHRSend = XMLHttpRequest.prototype.send;
    originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    // Metadata stored on the XHR instance via a WeakMap
    const xhrMeta = new WeakMap<
      XMLHttpRequest,
      {
        method: string;
        url: string;
        headers: Record<string, string>;
        startTime: number;
        body: string | null;
      }
    >();

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      const urlStr = typeof url === 'string' ? url : url.toString();
      xhrMeta.set(this, {
        method: method.toUpperCase(),
        url: urlStr,
        headers: {},
        startTime: 0,
        body: null,
      });
      return (originalXHROpen as Function).call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (
      name: string,
      value: string,
    ) {
      const meta = xhrMeta.get(this);
      if (meta) {
        meta.headers[name] = value;
      }
      return originalXHRSetRequestHeader!.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const meta = xhrMeta.get(this);
      if (!meta || shouldExclude(meta.url)) {
        return originalXHRSend!.call(this, body);
      }

      meta.startTime = performance.now();

      // Capture request body
      const reqContentType = meta.headers['content-type'] ?? meta.headers['Content-Type'] ?? '';
      if (isTextContentType(reqContentType) && typeof body === 'string') {
        if (body.length > maxBodySize) {
          meta.body = `[truncated, ${body.length} bytes total]`;
        } else {
          meta.body = sanitizer.sanitizeString(body);
        }
      }

      this.addEventListener('loadend', function () {
        const duration = Math.round(performance.now() - meta.startTime);

        // Parse response headers
        const rawHeaders = this.getAllResponseHeaders();
        const resHeaders: Record<string, string> = {};
        if (rawHeaders) {
          for (const line of rawHeaders.trim().split(/[\r\n]+/)) {
            const idx = line.indexOf(':');
            if (idx > 0) {
              const key = line.slice(0, idx).trim();
              const val = line.slice(idx + 1).trim();
              resHeaders[key] = val;
            }
          }
        }

        // Response body
        let responseBody: string | null = null;
        const resContentType = resHeaders['content-type'] ?? resHeaders['Content-Type'] ?? '';
        if (isTextContentType(resContentType)) {
          if (typeof this.response === 'string' || this.responseType === '' || this.responseType === 'text') {
            const text = this.responseText;
            if (text.length > maxBodySize) {
              responseBody = `[truncated, ${text.length} bytes total]`;
            } else {
              responseBody = sanitizer.sanitizeString(text);
            }
          }
        } else if (resContentType) {
          const contentLength = resHeaders['content-length'] ?? resHeaders['Content-Length'];
          if (contentLength) {
            responseBody = `[binary, ${contentLength} bytes]`;
          } else {
            responseBody = '[binary]';
          }
        }

        const entry: NetworkEntry = {
          method: meta.method,
          url: sanitizer.sanitizeUrl(meta.url),
          status: this.status || null,
          requestHeaders: sanitizer.sanitizeHeaders(meta.headers),
          responseHeaders: sanitizer.sanitizeHeaders(resHeaders),
          requestBody: meta.body,
          responseBody,
          duration,
          timestamp: Date.now(),
        };

        buffer.push(entry);
      });

      return originalXHRSend!.call(this, body);
    };
  }

  function start(): void {
    if (active) return;
    active = true;
    startFetchInterception();
    startXHRInterception();
  }

  function stop(): void {
    if (!active) return;
    active = false;

    if (originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = null;
    }

    if (originalXHROpen) {
      XMLHttpRequest.prototype.open = originalXHROpen;
      originalXHROpen = null;
    }

    if (originalXHRSend) {
      XMLHttpRequest.prototype.send = originalXHRSend;
      originalXHRSend = null;
    }

    if (originalXHRSetRequestHeader) {
      XMLHttpRequest.prototype.setRequestHeader = originalXHRSetRequestHeader;
      originalXHRSetRequestHeader = null;
    }
  }

  function getEntries(): NetworkEntry[] {
    return buffer.getAll();
  }

  function freeze(): NetworkEntry[] {
    return buffer.freeze();
  }

  function clear(): void {
    buffer.clear();
  }

  return {
    start,
    stop,
    getEntries,
    freeze,
    clear,
    /** @internal — used by the SDK to exclude its own report submission */
    setExcludedEndpoint,
  } as NetworkCapture & { setExcludedEndpoint: (endpoint: string) => void };
}
