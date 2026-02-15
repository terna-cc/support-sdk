// ─── SDK Configuration ───────────────────────────────────────────────

export interface SupportSDKConfig {
  endpoint: string;
  auth?: AuthConfig;
  capture?: CaptureConfig;
  privacy?: PrivacyConfig;
  ui?: UIConfig;
  theme?: ThemeConfig;
  user?: UserContext;
  chat?: ChatConfig;
  locale?: string;
}

// ─── Auth ────────────────────────────────────────────────────────────

export type AuthConfig =
  | { type: 'api-key'; key: string; headerName?: string }
  | { type: 'bearer'; token: string | (() => string | Promise<string>) }
  | { type: 'custom'; handler: (headers: Headers) => void | Promise<void> }
  | { type: 'none' };

// ─── Capture ─────────────────────────────────────────────────────────

export interface AttachmentConfig {
  enabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  allowedTypes?: string[];
}

export interface PerformanceCaptureConfig {
  longTaskThreshold?: number;
  maxLongTasks?: number;
}

export interface CaptureConfig {
  console?: false | (BufferConfig & { levels?: ConsoleLevel[] });
  network?: false | (BufferConfig & { urlFilter?: (url: string) => boolean });
  breadcrumbs?: false | BufferConfig;
  screenshot?: boolean;
  attachments?: AttachmentConfig;
  performance?: boolean | PerformanceCaptureConfig;
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

// ─── Theme ───────────────────────────────────────────────────────────

export interface ThemeConfig {
  // Colors
  primaryColor?: string;
  primaryTextColor?: string;
  backgroundColor?: string;
  textColor?: string;
  subtextColor?: string;
  assistantBubbleColor?: string;
  borderColor?: string;

  // Typography
  fontFamily?: string;
  fontSize?: string;

  // Trigger button
  triggerIcon?: string;
  triggerSize?: string;
  borderRadius?: string;

  // Panel
  panelWidth?: string;
  panelMaxHeight?: string;
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
  browser: string;
  os: string;
  language: string;
  platform: string;
  timezone: string;
  online: boolean;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  url: string;
  referrer: string;
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
  connection?: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
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
  type: 'error' | 'unhandledrejection';
  timestamp: number;
}

// ─── Attachment Metadata ──────────────────────────────────────────────

export interface AttachmentMetadata {
  name: string;
  size: number;
  type: string;
}

// ─── Performance Metrics ─────────────────────────────────────────────

export interface PerformanceMetrics {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  inp: number | null;
  ttfb: number | null;
  longTasks: LongTaskEntry[];
  memory: MemoryInfo | null;
}

export interface LongTaskEntry {
  duration: number;
  startTime: number;
  timestamp: number;
}

export interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
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
  performance: PerformanceMetrics | null;
  attachments?: AttachmentMetadata[];
  user: UserContext | null;
  metadata: Record<string, unknown>;
  sdk_version: string;
  captured_at: string;
  timestamp: number;
}

// ─── Chat ───────────────────────────────────────────────────────────

export interface ChatConfig {
  enabled?: boolean;
  maxMessages?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DiagnosticSnapshot {
  errors: ErrorInfo[];
  failedRequests: NetworkEntry[];
  consoleErrors: ConsoleEntry[];
  breadcrumbs: Breadcrumb[];
  browser: BrowserInfo;
  currentUrl: string;
  performance: PerformanceMetrics | null;
}

export interface ReportSummary {
  category: 'bug' | 'feedback' | 'feature_request';
  title: string;
  description: string;
  steps_to_reproduce: string[] | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}
