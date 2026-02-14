import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createRageClickCapture,
  describeElement,
  type RageClickCapture,
} from './rage-click';

function clickAt(
  x: number,
  y: number,
  target?: Element,
): void {
  const event = new MouseEvent('click', {
    clientX: x,
    clientY: y,
    bubbles: true,
  });

  // Dispatch on the target if provided, otherwise on document
  (target ?? document).dispatchEvent(event);
}

describe('createRageClickCapture', () => {
  let capture: RageClickCapture | null = null;

  afterEach(() => {
    capture?.destroy();
    capture = null;
    vi.restoreAllMocks();
  });

  describe('detection', () => {
    it('detects 3 rapid clicks in the same area as a rage click', () => {
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      document.body.appendChild(btn);

      clickAt(100, 100, btn);
      clickAt(102, 98, btn);
      clickAt(101, 101, btn);

      const detected = capture.getDetected();
      expect(detected).toHaveLength(1);
      expect(detected[0].clicks).toBeGreaterThanOrEqual(3);
      expect(detected[0].element).toContain('button');
      expect(detected[0].element).toContain('Submit');
      expect(detected[0].url).toBe(window.location.href);
      expect(detected[0].timestamp).toBeTypeOf('number');

      document.body.removeChild(btn);
    });

    it('does not trigger for normal click patterns (slow clicks)', () => {
      vi.useFakeTimers();
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      clickAt(100, 100, btn);
      vi.advanceTimersByTime(500);
      clickAt(100, 100, btn);
      vi.advanceTimersByTime(600);
      // Third click is beyond 1s window from the first
      clickAt(100, 100, btn);

      const detected = capture.getDetected();
      expect(detected).toHaveLength(0);

      document.body.removeChild(btn);
      vi.useRealTimers();
    });

    it('does not trigger for 2 clicks (below default threshold)', () => {
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      clickAt(100, 100, btn);
      clickAt(102, 98, btn);

      const detected = capture.getDetected();
      expect(detected).toHaveLength(0);

      document.body.removeChild(btn);
    });
  });

  describe('configuration', () => {
    it('respects custom threshold', () => {
      capture = createRageClickCapture({ threshold: 5 });

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      // 4 clicks — should not trigger with threshold=5
      clickAt(100, 100, btn);
      clickAt(101, 101, btn);
      clickAt(102, 102, btn);
      clickAt(103, 103, btn);

      expect(capture.getDetected()).toHaveLength(0);

      // 5th click triggers it
      clickAt(104, 104, btn);
      expect(capture.getDetected()).toHaveLength(1);
      expect(capture.getDetected()[0].clicks).toBeGreaterThanOrEqual(5);

      document.body.removeChild(btn);
    });

    it('respects custom time window', () => {
      vi.useFakeTimers();
      capture = createRageClickCapture({ timeWindow: 500 });

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      clickAt(100, 100, btn);
      vi.advanceTimersByTime(200);
      clickAt(100, 100, btn);
      vi.advanceTimersByTime(400);
      // Third click: 600ms after first — outside 500ms window
      clickAt(100, 100, btn);

      expect(capture.getDetected()).toHaveLength(0);

      document.body.removeChild(btn);
      vi.useRealTimers();
    });
  });

  describe('radius check', () => {
    it('clicks 50px apart do not trigger at default radius (30px)', () => {
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      clickAt(100, 100, btn);
      clickAt(150, 100, btn); // 50px away
      clickAt(100, 100, btn);

      // Only the first and third clicks are within radius of each other,
      // but the second is too far from the first. The count from the third
      // click's perspective: click1 is within radius, click2 is not, click3 is itself.
      // So count = 2 (click1 + click3), which is below threshold of 3.
      expect(capture.getDetected()).toHaveLength(0);

      document.body.removeChild(btn);
    });

    it('clicks within radius trigger detection', () => {
      capture = createRageClickCapture({ radiusPx: 50 });

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      clickAt(100, 100, btn);
      clickAt(130, 100, btn); // 30px away, within 50px radius
      clickAt(110, 100, btn); // 10px from first, within 50px radius

      expect(capture.getDetected()).toHaveLength(1);

      document.body.removeChild(btn);
    });
  });

  describe('debounce', () => {
    it('debounces duplicate detections on the same element within 2 seconds', () => {
      vi.useFakeTimers();
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      document.body.appendChild(btn);

      // First rage click sequence
      clickAt(100, 100, btn);
      clickAt(101, 101, btn);
      clickAt(102, 102, btn);

      expect(capture.getDetected()).toHaveLength(1);

      // More clicks within 2s debounce window — should not create a new entry
      vi.advanceTimersByTime(500);
      clickAt(100, 100, btn);
      clickAt(101, 101, btn);
      clickAt(102, 102, btn);

      expect(capture.getDetected()).toHaveLength(1);

      document.body.removeChild(btn);
      vi.useRealTimers();
    });

    it('records a new rage click after debounce period expires', () => {
      vi.useFakeTimers();
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      document.body.appendChild(btn);

      // First rage click sequence
      clickAt(100, 100, btn);
      clickAt(101, 101, btn);
      clickAt(102, 102, btn);

      expect(capture.getDetected()).toHaveLength(1);

      // Wait past debounce (2s) but stay within a new time window
      vi.advanceTimersByTime(2100);

      clickAt(100, 100, btn);
      clickAt(101, 101, btn);
      clickAt(102, 102, btn);

      expect(capture.getDetected()).toHaveLength(2);

      document.body.removeChild(btn);
      vi.useRealTimers();
    });
  });

  describe('RingBuffer cap', () => {
    it('caps stored rage clicks at maxItems', () => {
      vi.useFakeTimers();
      capture = createRageClickCapture({ maxItems: 3 });

      const btn = document.createElement('button');
      btn.id = 'test-btn';
      btn.textContent = 'Click me';
      document.body.appendChild(btn);

      // Generate 5 rage click events (with debounce gaps)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(2100);
        clickAt(100, 100, btn);
        clickAt(101, 101, btn);
        clickAt(102, 102, btn);
      }

      const detected = capture.getDetected();
      expect(detected).toHaveLength(3);

      document.body.removeChild(btn);
      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('removes event listener and stops detecting', () => {
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      document.body.appendChild(btn);

      // Verify it works before destroy
      clickAt(100, 100, btn);
      clickAt(101, 101, btn);
      clickAt(102, 102, btn);

      expect(capture.getDetected()).toHaveLength(1);

      capture.destroy();

      // New clicks after destroy should not be captured
      clickAt(200, 200, btn);
      clickAt(201, 201, btn);
      clickAt(202, 202, btn);

      // Still only the original detection
      expect(capture.getDetected()).toHaveLength(1);

      document.body.removeChild(btn);
      capture = null; // Prevent double-destroy in afterEach
    });
  });

  describe('RageClick entry fields', () => {
    it('includes all required fields', () => {
      capture = createRageClickCapture();

      const btn = document.createElement('button');
      btn.id = 'submit-btn';
      btn.textContent = 'Submit';
      document.body.appendChild(btn);

      clickAt(150, 200, btn);
      clickAt(152, 198, btn);
      clickAt(151, 201, btn);

      const detected = capture.getDetected();
      expect(detected).toHaveLength(1);

      const entry = detected[0];
      expect(entry.element).toContain('button');
      expect(entry.element).toContain('#submit-btn');
      expect(entry.element).toContain('Submit');
      expect(entry.x).toBe(151);
      expect(entry.y).toBe(201);
      expect(entry.clicks).toBeGreaterThanOrEqual(3);
      expect(entry.timestamp).toBeTypeOf('number');
      expect(entry.url).toBe(window.location.href);

      document.body.removeChild(btn);
    });
  });
});

describe('describeElement', () => {
  it('includes tag name', () => {
    const el = document.createElement('button');
    expect(describeElement(el)).toBe('button');
  });

  it('includes id when present', () => {
    const el = document.createElement('a');
    el.id = 'login-link';
    expect(describeElement(el)).toContain('#login-link');
  });

  it('includes first class name', () => {
    const el = document.createElement('div');
    el.className = 'card highlighted';
    expect(describeElement(el)).toContain('.card');
    expect(describeElement(el)).not.toContain('.highlighted');
  });

  it('includes truncated text content', () => {
    const el = document.createElement('span');
    el.textContent = 'Click here to submit your form';
    expect(describeElement(el)).toContain('"Click here to submit your form"');
  });

  it('truncates text content at 30 characters', () => {
    const el = document.createElement('p');
    el.textContent =
      'This is a very long text that should be truncated at thirty characters limit';
    const desc = describeElement(el);
    const textMatch = desc.match(/"(.+)"/)?.[1] ?? '';
    expect(textMatch.length).toBeLessThanOrEqual(30);
  });

  it('handles elements with no id, class, or text', () => {
    const el = document.createElement('div');
    expect(describeElement(el)).toBe('div');
  });
});
