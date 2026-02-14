export { SupportSDK } from './sdk';
export { SDK_VERSION } from './version';

export type {
  SupportSDKConfig,
  AuthConfig,
  CaptureConfig,
  BufferConfig,
  PrivacyConfig,
  UIConfig,
  UserContext,
  ConsoleLevel,
  ConsoleEntry,
  NetworkEntry,
  BrowserInfo,
  Breadcrumb,
  ErrorInfo,
  DiagnosticReport,
} from './types';

export { RingBuffer } from './core/ring-buffer';
export { Sanitizer } from './core/sanitizer';
export type { SanitizerConfig } from './core/sanitizer';
