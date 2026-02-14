import { describe, it, expect, vi, beforeEach } from 'vitest';
import { collectBrowserInfo } from './browser';

describe('collectBrowserInfo', () => {
  beforeEach(() => {
    // jsdom provides basic navigator/window/screen globals
    // We mock specific values for deterministic tests
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      writable: true,
    });
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      writable: true,
    });
  });

  it('returns all required fields', () => {
    const info = collectBrowserInfo();

    expect(info).toHaveProperty('userAgent');
    expect(info).toHaveProperty('browser');
    expect(info).toHaveProperty('os');
    expect(info).toHaveProperty('language');
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('timezone');
    expect(info).toHaveProperty('online');
    expect(info).toHaveProperty('screenWidth');
    expect(info).toHaveProperty('screenHeight');
    expect(info).toHaveProperty('viewportWidth');
    expect(info).toHaveProperty('viewportHeight');
    expect(info).toHaveProperty('devicePixelRatio');
    expect(info).toHaveProperty('url');
    expect(info).toHaveProperty('referrer');
  });

  it('returns correct types for all fields', () => {
    const info = collectBrowserInfo();

    expect(info.userAgent).toBeTypeOf('string');
    expect(info.browser).toBeTypeOf('string');
    expect(info.os).toBeTypeOf('string');
    expect(info.language).toBeTypeOf('string');
    expect(info.platform).toBeTypeOf('string');
    expect(info.timezone).toBeTypeOf('string');
    expect(info.online).toBeTypeOf('boolean');
    expect(info.screenWidth).toBeTypeOf('number');
    expect(info.screenHeight).toBeTypeOf('number');
    expect(info.viewportWidth).toBeTypeOf('number');
    expect(info.viewportHeight).toBeTypeOf('number');
    expect(info.devicePixelRatio).toBeTypeOf('number');
    expect(info.url).toBeTypeOf('string');
    expect(info.referrer).toBeTypeOf('string');
  });

  it('handles missing optional fields (memory, connection) gracefully', () => {
    // jsdom does not provide performance.memory or navigator.connection
    const info = collectBrowserInfo();

    expect(info.memory).toBeUndefined();
    expect(info.connection).toBeUndefined();
  });

  it('includes memory info when available', () => {
    const mockMemory = {
      jsHeapSizeLimit: 2000000000,
      totalJSHeapSize: 50000000,
      usedJSHeapSize: 30000000,
    };

    Object.defineProperty(performance, 'memory', {
      value: mockMemory,
      configurable: true,
    });

    const info = collectBrowserInfo();
    expect(info.memory).toEqual(mockMemory);

    // Clean up
    Object.defineProperty(performance, 'memory', {
      value: undefined,
      configurable: true,
    });
  });

  it('includes connection info when available', () => {
    const mockConnection = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
    };

    Object.defineProperty(navigator, 'connection', {
      value: mockConnection,
      configurable: true,
    });

    const info = collectBrowserInfo();
    expect(info.connection).toEqual(mockConnection);

    // Clean up
    Object.defineProperty(navigator, 'connection', {
      value: undefined,
      configurable: true,
    });
  });

  describe('UA parsing', () => {
    it('parses Chrome user agent', () => {
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(chromeUA);

      const info = collectBrowserInfo();
      expect(info.browser).toContain('Chrome');
      expect(info.browser).toContain('120');
      expect(info.os).toContain('Windows');

      vi.restoreAllMocks();
    });

    it('parses Firefox user agent', () => {
      const firefoxUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(firefoxUA);

      const info = collectBrowserInfo();
      expect(info.browser).toContain('Firefox');
      expect(info.browser).toContain('121');
      expect(info.os).toContain('macOS');

      vi.restoreAllMocks();
    });

    it('parses Edge user agent', () => {
      const edgeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(edgeUA);

      const info = collectBrowserInfo();
      expect(info.browser).toContain('Edge');

      vi.restoreAllMocks();
    });

    it('parses Safari user agent', () => {
      const safariUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(safariUA);

      const info = collectBrowserInfo();
      expect(info.browser).toContain('Safari');
      expect(info.browser).toContain('17.2');

      vi.restoreAllMocks();
    });

    it('returns Unknown for unrecognized UA strings', () => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
        'SomeWeirdBot/1.0',
      );

      const info = collectBrowserInfo();
      expect(info.browser).toBe('Unknown');
      expect(info.os).toBe('Unknown');

      vi.restoreAllMocks();
    });

    it('parses Android user agent', () => {
      const androidUA =
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(androidUA);

      const info = collectBrowserInfo();
      expect(info.os).toContain('Android');
      expect(info.os).toContain('13');

      vi.restoreAllMocks();
    });

    it('parses iOS user agent', () => {
      const iosUA =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iosUA);

      const info = collectBrowserInfo();
      expect(info.os).toContain('iOS');
      expect(info.os).toContain('17.2');

      vi.restoreAllMocks();
    });
  });

  it('reads viewport dimensions from window', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1440,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      writable: true,
    });

    const info = collectBrowserInfo();
    expect(info.viewportWidth).toBe(1440);
    expect(info.viewportHeight).toBe(900);
  });

  it('reads timezone from Intl API', () => {
    const info = collectBrowserInfo();
    // jsdom should provide a timezone string
    expect(info.timezone).toBeTypeOf('string');
    expect(info.timezone.length).toBeGreaterThan(0);
  });
});
