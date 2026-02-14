import { RingBuffer } from '../core/ring-buffer';
import type { Breadcrumb } from '../types';

export interface BreadcrumbCapture {
  start(): void;
  stop(): void;
  addBreadcrumb(crumb: {
    type: 'custom';
    message: string;
    data?: Record<string, unknown>;
  }): void;
  getEntries(): Breadcrumb[];
  freeze(): Breadcrumb[];
  clear(): void;
}

const MAX_TEXT_LENGTH = 50;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function getTextContent(el: Element): string {
  const text = (el.textContent ?? '').trim();
  return truncate(text, MAX_TEXT_LENGTH);
}

function getSelectorPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  for (let depth = 0; current && depth < 3; depth++) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0] !== '') {
        selector += '.' + classes.join('.');
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function stripQueryParams(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    // If URL parsing fails, strip query string manually
    const qIndex = url.indexOf('?');
    return qIndex >= 0 ? url.slice(0, qIndex) : url;
  }
}

export function createBreadcrumbCapture(bufferSize: number): BreadcrumbCapture {
  const buffer = new RingBuffer<Breadcrumb>(bufferSize);
  let active = false;

  // Stored references for cleanup
  let clickHandler: ((e: Event) => void) | null = null;
  let popstateHandler: ((e: Event) => void) | null = null;
  let originalPushState: typeof history.pushState | null = null;
  let originalReplaceState: typeof history.replaceState | null = null;

  function start(): void {
    if (active) return;
    active = true;

    // --- Click tracking ---
    clickHandler = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const tag = target.tagName.toLowerCase();
      const text = getTextContent(target);
      const selector = getSelectorPath(target);

      const message = text ? `Clicked <${tag}> "${text}"` : `Clicked <${tag}>`;

      buffer.push({
        type: 'click',
        message,
        data: { selector },
        timestamp: Date.now(),
      });
    };

    document.addEventListener('click', clickHandler, true);

    // --- Navigation tracking ---
    let lastUrl = stripQueryParams(location.href);

    function recordNavigation(toUrl: string): void {
      const strippedTo = stripQueryParams(toUrl);
      if (strippedTo === lastUrl) return;

      const pathname = (() => {
        try {
          return new URL(strippedTo).pathname;
        } catch {
          return strippedTo;
        }
      })();

      buffer.push({
        type: 'navigation',
        message: `Navigated to ${pathname}`,
        data: { from: lastUrl, to: strippedTo },
        timestamp: Date.now(),
      });

      lastUrl = strippedTo;
    }

    popstateHandler = () => {
      recordNavigation(location.href);
    };

    window.addEventListener('popstate', popstateHandler);

    // Wrap history.pushState and history.replaceState
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;

    history.pushState = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      originalPushState!.call(history, data, unused, url);
      if (url) {
        const fullUrl =
          url instanceof URL
            ? url.toString()
            : new URL(url, location.href).toString();
        recordNavigation(fullUrl);
      }
    };

    history.replaceState = function (
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      originalReplaceState!.call(history, data, unused, url);
      if (url) {
        const fullUrl =
          url instanceof URL
            ? url.toString()
            : new URL(url, location.href).toString();
        recordNavigation(fullUrl);
      }
    };
  }

  function stop(): void {
    if (!active) return;
    active = false;

    if (clickHandler) {
      document.removeEventListener('click', clickHandler, true);
      clickHandler = null;
    }

    if (popstateHandler) {
      window.removeEventListener('popstate', popstateHandler);
      popstateHandler = null;
    }

    if (originalPushState) {
      history.pushState = originalPushState;
      originalPushState = null;
    }

    if (originalReplaceState) {
      history.replaceState = originalReplaceState;
      originalReplaceState = null;
    }
  }

  function addBreadcrumb(crumb: {
    type: 'custom';
    message: string;
    data?: Record<string, unknown>;
  }): void {
    buffer.push({
      type: crumb.type,
      message: crumb.message,
      data: crumb.data,
      timestamp: Date.now(),
    });
  }

  function getEntries(): Breadcrumb[] {
    return buffer.getAll();
  }

  function freeze(): Breadcrumb[] {
    return buffer.freeze();
  }

  function clear(): void {
    buffer.clear();
  }

  return { start, stop, addBreadcrumb, getEntries, freeze, clear };
}
