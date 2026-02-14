import { RingBuffer } from '../core/ring-buffer';

// ─── Types ──────────────────────────────────────────────────────────

export interface RageClick {
  element: string;
  x: number;
  y: number;
  clicks: number;
  timestamp: number;
  url: string;
}

export interface RageClickCapture {
  getDetected(): RageClick[];
  destroy(): void;
}

interface ClickRecord {
  x: number;
  y: number;
  target: string;
  timestamp: number;
}

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 3;
const DEFAULT_TIME_WINDOW = 1000;
const DEFAULT_RADIUS_PX = 30;
const DEFAULT_MAX_ITEMS = 20;
const DEBOUNCE_MS = 2000;

// ─── Helpers ────────────────────────────────────────────────────────

export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  let cls = '';
  if (el.className && typeof el.className === 'string') {
    const first = el.className.trim().split(/\s+/)[0];
    if (first) cls = `.${first}`;
  }
  const text = (el.textContent ?? '').trim().slice(0, 30);
  return `${tag}${id}${cls}${text ? ` "${text}"` : ''}`;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ─── Factory ────────────────────────────────────────────────────────

export function createRageClickCapture(config?: {
  threshold?: number;
  timeWindow?: number;
  radiusPx?: number;
  maxItems?: number;
}): RageClickCapture {
  const threshold = config?.threshold ?? DEFAULT_THRESHOLD;
  const timeWindow = config?.timeWindow ?? DEFAULT_TIME_WINDOW;
  const radiusPx = config?.radiusPx ?? DEFAULT_RADIUS_PX;
  const maxItems = config?.maxItems ?? DEFAULT_MAX_ITEMS;

  const buffer = new RingBuffer<RageClick>(maxItems);
  const recentClicks: ClickRecord[] = [];

  // Track last rage click per element description to debounce
  const lastRageClickTime = new Map<string, number>();

  function handleClick(e: MouseEvent): void {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const now = Date.now();
    const x = e.clientX;
    const y = e.clientY;
    const desc = describeElement(target);

    // Add to recent clicks
    recentClicks.push({ x, y, target: desc, timestamp: now });

    // Prune clicks outside the time window
    while (
      recentClicks.length > 0 &&
      now - recentClicks[0].timestamp > timeWindow
    ) {
      recentClicks.shift();
    }

    // Count clicks within radius and time window
    let count = 0;
    for (const click of recentClicks) {
      if (
        now - click.timestamp <= timeWindow &&
        distance(x, y, click.x, click.y) <= radiusPx
      ) {
        count++;
      }
    }

    if (count >= threshold) {
      // Check debounce — skip if we recorded a rage click on this element recently
      const lastTime = lastRageClickTime.get(desc);
      if (lastTime !== undefined && now - lastTime < DEBOUNCE_MS) {
        return;
      }

      lastRageClickTime.set(desc, now);

      buffer.push({
        element: desc,
        x,
        y,
        clicks: count,
        timestamp: recentClicks[0].timestamp,
        url: window.location.href,
      });
    }
  }

  document.addEventListener('click', handleClick, true);

  function getDetected(): RageClick[] {
    return buffer.getAll();
  }

  function destroy(): void {
    document.removeEventListener('click', handleClick, true);
    recentClicks.length = 0;
    lastRageClickTime.clear();
  }

  return { getDetected, destroy };
}
