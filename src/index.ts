import type { SupportSDKConfig, DiagnosticReport } from './types';

export class SupportSDK {
  private config: SupportSDKConfig;

  constructor(config: SupportSDKConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    // TODO: Start capture modules, attach UI
    void this.config;
  }

  async destroy(): Promise<void> {
    // TODO: Stop capture modules, remove UI, restore patched globals
  }

  async submitReport(_description: string): Promise<DiagnosticReport> {
    // TODO: Gather data from all capture modules, sanitize, submit
    throw new Error('Not implemented');
  }
}

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
