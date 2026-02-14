import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScreenshotCapture } from './screenshot';

// Mock modern-screenshot since jsdom doesn't support canvas rendering
vi.mock('modern-screenshot', () => ({
  domToBlob: vi.fn(),
}));

import { domToBlob } from 'modern-screenshot';

const mockedDomToBlob = vi.mocked(domToBlob);

describe('createScreenshotCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Clean up any leftover mask overlays
    document
      .querySelectorAll('[data-screenshot-mask]')
      .forEach((el) => el.remove());
    document.body.innerHTML = '';
  });

  // ─── Config defaults ────────────────────────────────────────────

  it('applies default config when none is provided', async () => {
    mockedDomToBlob.mockResolvedValue(
      new Blob(['fake'], { type: 'image/jpeg' }),
    );

    const capture = createScreenshotCapture();
    await capture.capture();

    expect(mockedDomToBlob).toHaveBeenCalledWith(
      document.documentElement,
      expect.objectContaining({
        type: 'image/jpeg',
        quality: 0.7,
        scale: 1,
      }),
    );
  });

  it('merges custom config with defaults', async () => {
    mockedDomToBlob.mockResolvedValue(
      new Blob(['fake'], { type: 'image/jpeg' }),
    );

    const capture = createScreenshotCapture({ quality: 0.5, maxWidth: 800 });
    await capture.capture();

    expect(mockedDomToBlob).toHaveBeenCalledWith(
      document.documentElement,
      expect.objectContaining({
        type: 'image/jpeg',
        quality: 0.5,
      }),
    );
  });

  // ─── Mask overlay creation ──────────────────────────────────────

  it('creates mask overlays for matching elements', async () => {
    document.body.innerHTML = `
      <input type="password" id="pw" />
      <div data-sensitive>secret</div>
      <div class="sensitive">also secret</div>
      <div class="public">visible</div>
    `;

    // Make domToBlob resolve so we can check cleanup
    mockedDomToBlob.mockImplementation(async () => {
      // At capture time, mask container should exist in the DOM
      const maskContainer = document.querySelector('[data-screenshot-mask]');
      expect(maskContainer).not.toBeNull();
      // 3 sensitive elements matched → 3 child mask divs
      expect(maskContainer!.children.length).toBe(3);
      return new Blob(['fake'], { type: 'image/jpeg' });
    });

    const capture = createScreenshotCapture();
    await capture.capture();
  });

  it('mask container has correct styles', async () => {
    document.body.innerHTML = '<input type="password" />';

    mockedDomToBlob.mockImplementation(async () => {
      const maskContainer = document.querySelector(
        '[data-screenshot-mask]',
      ) as HTMLDivElement;
      expect(maskContainer).not.toBeNull();
      expect(maskContainer.style.position).toBe('fixed');
      expect(maskContainer.style.top).toBe('0px');
      expect(maskContainer.style.left).toBe('0px');
      expect(maskContainer.style.pointerEvents).toBe('none');
      expect(maskContainer.style.zIndex).toBe('999999');
      return new Blob(['fake'], { type: 'image/jpeg' });
    });

    const capture = createScreenshotCapture();
    await capture.capture();
  });

  it('mask child divs have black background', async () => {
    document.body.innerHTML = '<div class="sensitive">secret</div>';

    mockedDomToBlob.mockImplementation(async () => {
      const maskContainer = document.querySelector('[data-screenshot-mask]');
      const maskChild = maskContainer!.children[0] as HTMLDivElement;
      expect(maskChild.style.background).toBe('#000');
      expect(maskChild.style.position).toBe('absolute');
      return new Blob(['fake'], { type: 'image/jpeg' });
    });

    const capture = createScreenshotCapture();
    await capture.capture();
  });

  it('does not create mask container when no elements match', async () => {
    document.body.innerHTML = '<div class="public">visible</div>';

    mockedDomToBlob.mockImplementation(async () => {
      const maskContainer = document.querySelector('[data-screenshot-mask]');
      expect(maskContainer).toBeNull();
      return new Blob(['fake'], { type: 'image/jpeg' });
    });

    const capture = createScreenshotCapture();
    await capture.capture();
  });

  it('uses custom maskSelectors', async () => {
    document.body.innerHTML = `
      <div class="custom-mask">masked</div>
      <div class="sensitive">not masked with custom config</div>
    `;

    mockedDomToBlob.mockImplementation(async () => {
      const maskContainer = document.querySelector('[data-screenshot-mask]');
      expect(maskContainer).not.toBeNull();
      expect(maskContainer!.children.length).toBe(1);
      return new Blob(['fake'], { type: 'image/jpeg' });
    });

    const capture = createScreenshotCapture({
      maskSelectors: ['.custom-mask'],
    });
    await capture.capture();
  });

  // ─── Mask overlay cleanup ──────────────────────────────────────

  it('removes mask overlays after successful capture', async () => {
    document.body.innerHTML = '<input type="password" />';
    mockedDomToBlob.mockResolvedValue(
      new Blob(['fake'], { type: 'image/jpeg' }),
    );

    const capture = createScreenshotCapture();
    await capture.capture();

    expect(document.querySelector('[data-screenshot-mask]')).toBeNull();
  });

  it('removes mask overlays even when capture fails', async () => {
    document.body.innerHTML = '<input type="password" />';
    mockedDomToBlob.mockRejectedValue(new Error('Canvas tainted'));

    const capture = createScreenshotCapture();
    const result = await capture.capture();

    expect(result).toBeNull();
    expect(document.querySelector('[data-screenshot-mask]')).toBeNull();
  });

  // ─── Capture result ─────────────────────────────────────────────

  it('returns a Blob on successful capture', async () => {
    const fakeBlob = new Blob(['image-data'], { type: 'image/jpeg' });
    mockedDomToBlob.mockResolvedValue(fakeBlob);

    const capture = createScreenshotCapture();
    const result = await capture.capture();

    expect(result).toBe(fakeBlob);
  });

  it('returns null when domToBlob throws', async () => {
    mockedDomToBlob.mockRejectedValue(new Error('CORS error'));

    const capture = createScreenshotCapture();
    const result = await capture.capture();

    expect(result).toBeNull();
  });

  it('returns null when domToBlob throws non-Error', async () => {
    mockedDomToBlob.mockRejectedValue('unexpected string error');

    const capture = createScreenshotCapture();
    const result = await capture.capture();

    expect(result).toBeNull();
  });

  // ─── Dimension constraints ──────────────────────────────────────

  it('passes maxWidth and maxHeight constraints to domToBlob', async () => {
    mockedDomToBlob.mockResolvedValue(
      new Blob(['fake'], { type: 'image/jpeg' }),
    );

    const capture = createScreenshotCapture({ maxWidth: 800, maxHeight: 600 });
    await capture.capture();

    const callArgs = mockedDomToBlob.mock.calls[0][1] as {
      width: number;
      height: number;
    };
    expect(callArgs.width).toBeLessThanOrEqual(800);
    expect(callArgs.height).toBeLessThanOrEqual(600);
  });

  // ─── Invalid selectors ──────────────────────────────────────────

  it('handles invalid CSS selectors gracefully', async () => {
    document.body.innerHTML = '<div class="sensitive">secret</div>';
    mockedDomToBlob.mockResolvedValue(
      new Blob(['fake'], { type: 'image/jpeg' }),
    );

    const capture = createScreenshotCapture({
      maskSelectors: ['[invalid!!!', '.sensitive'],
    });
    const result = await capture.capture();

    // Should still succeed — invalid selector is skipped, .sensitive is masked
    expect(result).not.toBeNull();
  });

  // ─── Multiple captures ─────────────────────────────────────────

  it('can capture multiple times', async () => {
    mockedDomToBlob.mockResolvedValue(
      new Blob(['fake'], { type: 'image/jpeg' }),
    );

    const capture = createScreenshotCapture();
    const first = await capture.capture();
    const second = await capture.capture();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(mockedDomToBlob).toHaveBeenCalledTimes(2);
  });
});
