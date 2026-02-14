// ─── SDK Configuration ───────────────────────────────────────────────

export interface SupportSDKConfig {
  endpoint: string;
  auth?: AuthConfig;
  capture?: CaptureConfig;
  privacy?: PrivacyConfig;
  ui?: UIConfig;
  user?: UserContext;
}

// ─── Auth ────────────────────────────────────────────────────────────

export type AuthConfig =
  | { type: 'api-key'; key: string; headerName?: string }
  | { type: 'bearer'; token: string | (() => string | Promise<string>) }
  | { type: 'custom'; handler: (headers: Headers) => void | Promise<void> }
  | { type: 'none' };

// ─── Capture ─────────────────────────────────────────────────────────

export interface CaptureConfig {
  console?: BufferConfig & { levels?: ConsoleLevel[] };
  network?: BufferConfig & { urlFilter?: (url: string) => boolean };
  breadcrumbs?: BufferConfig;
  screenshot?: boolean;
}

export interface BufferConfig {
  maxItems?: number;
}

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

// ─── Privacy ─────────────────────────────────────────────────────────

export interface PrivacyConfig {
  redactPatterns?: RegExp[];
  sensitiveHeaders?: string[];
  sensitiveParams?: string[];
  maxBodySize?: number;
  stripBodies?: boolean;
}

// ─── UI ──────────────────────────────────────────────────────────────

export interface UIConfig {
  triggerPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  triggerLabel?: string;
  modalTitle?: string;
  showTrigger?: boolean;
}

// ─── User Context ────────────────────────────────────────────────────

export interface UserContext {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

// ─── Captured Data Types ─────────────────────────────────────────────

export interface ConsoleEntry {
  level: ConsoleLevel;
  message: string;
  args: string[];
  timestamp: number;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  duration: number | null;
  timestamp: number;
}

export interface BrowserInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  url: string;
  referrer: string;
}

export interface Breadcrumb {
  type: 'click' | 'input' | 'navigation' | 'custom';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  timestamp: number;
}

// ─── Diagnostic Report (the full payload) ────────────────────────────

export interface DiagnosticReport {
  id?: string;
  description: string;
  console: ConsoleEntry[];
  network: NetworkEntry[];
  breadcrumbs: Breadcrumb[];
  browser: BrowserInfo;
  screenshot: string | null;
  errors: ErrorInfo[];
  user: UserContext | null;
  metadata: Record<string, unknown>;
  timestamp: number;
}
