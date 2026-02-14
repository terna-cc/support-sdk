import type { BrowserInfo } from '../types';

function parseBrowser(ua: string): string {
  // Order matters — check more specific browsers first
  const browsers: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/(\S+)/, 'Edge'],
    [/OPR\/(\S+)/, 'Opera'],
    [/SamsungBrowser\/(\S+)/, 'Samsung Internet'],
    [/(?:Chrome|CriOS)\/(\S+)/, 'Chrome'],
    [/(?:Firefox|FxiOS)\/(\S+)/, 'Firefox'],
    [/Version\/(\S+).*Safari/, 'Safari'],
  ];

  for (const [pattern, name] of browsers) {
    const match = ua.match(pattern);
    if (match) {
      return `${name} ${match[1]}`;
    }
  }

  return 'Unknown';
}

function parseOS(ua: string): string {
  const osPatterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/Windows NT ([\d.]+)/, (m) => `Windows ${m[1]}`],
    [/Mac OS X ([\d._]+)/, (m) => `macOS ${m[1].replace(/_/g, '.')}`],
    [/Android ([\d.]+)/, (m) => `Android ${m[1]}`],
    [/iPhone OS ([\d_]+)/, (m) => `iOS ${m[1].replace(/_/g, '.')}`],
    [/iPad.*OS ([\d_]+)/, (m) => `iPadOS ${m[1].replace(/_/g, '.')}`],
    [/Linux/, () => 'Linux'],
    [/CrOS/, () => 'Chrome OS'],
  ];

  for (const [pattern, formatter] of osPatterns) {
    const match = ua.match(pattern);
    if (match) {
      return formatter(match);
    }
  }

  return 'Unknown';
}

export function collectBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent;

  const info: BrowserInfo = {
    userAgent: ua,
    browser: parseBrowser(ua),
    os: parseOS(ua),
    language: navigator.language,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    url: window.location.href,
    referrer: document.referrer,
  };

  // Chrome-only: performance.memory
  const perf = performance as unknown as {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  };
  if (perf.memory) {
    info.memory = {
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      usedJSHeapSize: perf.memory.usedJSHeapSize,
    };
  }

  // Network Information API (optional)
  const nav = navigator as unknown as {
    connection?: { effectiveType: string; downlink: number; rtt: number };
  };
  if (nav.connection) {
    info.connection = {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt,
    };
  }

  return info;
}
