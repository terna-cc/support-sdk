export { SupportSDK } from './sdk';
export { SDK_VERSION } from './version';

export type {
  SupportSDKConfig,
  AuthConfig,
  AttachmentConfig,
  CaptureConfig,
  BufferConfig,
  PerformanceCaptureConfig,
  PrivacyConfig,
  ThemeConfig,
  UIConfig,
  UserContext,
  ConsoleLevel,
  ConsoleEntry,
  NetworkEntry,
  BrowserInfo,
  Breadcrumb,
  ErrorInfo,
  AttachmentMetadata,
  PerformanceMetrics,
  LongTaskEntry,
  MemoryInfo,
  DiagnosticReport,
  ChatConfig,
  ChatMessage,
  DiagnosticSnapshot,
  ReportSummary,
} from './types';

export { buildThemeVars } from './ui/styles';
export { RingBuffer } from './core/ring-buffer';
export { Sanitizer } from './core/sanitizer';
export type { SanitizerConfig } from './core/sanitizer';
export { getTranslations } from './i18n/translations';
export type { Translations } from './i18n/translations';
