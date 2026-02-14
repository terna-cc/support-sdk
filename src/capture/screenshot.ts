import { domToBlob } from 'modern-screenshot';

// ─── Config ─────────────────────────────────────────────────────────

export interface ScreenshotConfig {
  maskSelectors: string[];
  quality: number;
  maxWidth: number;
  maxHeight: number;
}

const DEFAULT_CONFIG: ScreenshotConfig = {
  maskSelectors: ['input[type="password"]', '[data-sensitive]', '.sensitive'],
  quality: 0.7,
  maxWidth: 1920,
  maxHeight: 1080,
};

// ─── Interface ──────────────────────────────────────────────────────

export interface ScreenshotCapture {
  capture(): Promise<Blob | null>;
}

// ─── Masking helpers ────────────────────────────────────────────────

function createMaskOverlay(
  selectors: string[],
  doc: Document,
): HTMLDivElement | null {
  const elements: Element[] = [];
  for (const selector of selectors) {
    try {
      elements.push(...doc.querySelectorAll(selector));
    } catch {
      // invalid selector — skip silently
    }
  }

  if (elements.length === 0) return null;

  const container = doc.createElement('div');
  container.setAttribute('data-screenshot-mask', 'true');
  container.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;';

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const mask = doc.createElement('div');
    mask.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;background:#000;`;
    container.appendChild(mask);
  }

  doc.body.appendChild(container);
  return container;
}

function removeMaskOverlay(container: HTMLDivElement | null): void {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

// ─── Factory ────────────────────────────────────────────────────────

export function createScreenshotCapture(
  config?: Partial<ScreenshotConfig>,
): ScreenshotCapture {
  const resolved: ScreenshotConfig = { ...DEFAULT_CONFIG, ...config };

  async function capture(): Promise<Blob | null> {
    let maskContainer: HTMLDivElement | null = null;

    try {
      // Step 1 — mask sensitive elements
      maskContainer = createMaskOverlay(resolved.maskSelectors, document);

      // Step 2 — capture the viewport as a JPEG blob
      const blob = await domToBlob(document.documentElement, {
        type: 'image/jpeg',
        quality: resolved.quality,
        width: Math.min(
          document.documentElement.scrollWidth || resolved.maxWidth,
          resolved.maxWidth,
        ),
        height: Math.min(
          document.documentElement.scrollHeight || resolved.maxHeight,
          resolved.maxHeight,
        ),
        scale: 1,
      });

      return blob;
    } catch {
      // Capture can fail due to CORS, unsupported elements, etc.
      return null;
    } finally {
      // Step 5 — always clean up mask overlays
      removeMaskOverlay(maskContainer);
    }
  }

  return { capture };
}
