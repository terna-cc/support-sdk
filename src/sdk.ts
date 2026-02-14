import type { SupportSDKConfig, UserContext, ErrorInfo } from './types';
import { Sanitizer } from './core/sanitizer';
import { createConsoleCapture, type ConsoleCapture } from './capture/console';
import { createNetworkCapture, type NetworkCapture } from './capture/network';
import { collectBrowserInfo } from './capture/browser';
import {
  createScreenshotCapture,
  type ScreenshotCapture,
} from './capture/screenshot';
import {
  createBreadcrumbCapture,
  type BreadcrumbCapture,
} from './capture/breadcrumbs';
import { createErrorCapture, type ErrorCapture } from './capture/errors';
import { createTransport, type Transport } from './transport/http';
import { resolveAuthHeaders } from './transport/http';
import { createReviewModal, type ReviewModal } from './ui/modal';
import { createTriggerButton, type TriggerButton } from './ui/trigger';
import { createToast, type Toast } from './ui/toast';
import {
  createChatManager,
  ChatTransportError,
  type ChatManager,
} from './chat/chat-manager';
import { SDK_VERSION } from './version';
import { getTranslations, type Translations } from './i18n/translations';

// ─── Defaults ────────────────────────────────────────────────────────

const DEFAULT_BUFFER_SIZE = 100;
const DEFAULT_NETWORK_BUFFER_SIZE = 50;
const DEFAULT_BREADCRUMB_BUFFER_SIZE = 50;
const DEFAULT_PRIMARY_COLOR = '#6366f1';

// ─── Singleton guard ─────────────────────────────────────────────────

let instance: SupportSDK | null = null;

// ─── Main class ──────────────────────────────────────────────────────

export class SupportSDK {
  private config: SupportSDKConfig;
  private sanitizer: Sanitizer | null = null;
  private consoleCapture: ConsoleCapture | null = null;
  private networkCapture:
    | (NetworkCapture & { setExcludedEndpoint: (endpoint: string) => void })
    | null = null;
  private breadcrumbCapture: BreadcrumbCapture | null = null;
  private screenshotCapture: ScreenshotCapture | null = null;
  private errorCapture: ErrorCapture | null = null;
  private transport: Transport | null = null;
  private modal: ReviewModal | null = null;
  private trigger: TriggerButton | null = null;
  private toast: Toast | null = null;
  private chatMgr: ChatManager | null = null;

  private userContext: UserContext | null = null;
  private metadata: Record<string, unknown> = {};
  private destroyed = false;
  private locale: string;
  private translations: Translations;

  // Frozen data from error auto-capture
  private frozenErrorInfo: ErrorInfo | null = null;

  private constructor(config: SupportSDKConfig) {
    this.config = config;
    this.userContext = config.user ?? null;
    this.locale = config.locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en');
    this.translations = getTranslations(this.locale);
  }

  static init(config: SupportSDKConfig): SupportSDK {
    if (instance) {
      console.warn(
        '[SupportSDK] Already initialized. Call destroy() before re-initializing.',
      );
      return instance;
    }

    if (!config.endpoint) {
      throw new Error('[SupportSDK] "endpoint" is required in config.');
    }

    const sdk = new SupportSDK(config);
    sdk.setup();
    instance = sdk;
    return sdk;
  }

  private setup(): void {
    const captureConfig = this.config.capture ?? {};
    const privacyConfig = this.config.privacy ?? {};
    const uiConfig = this.config.ui ?? {};
    const primaryColor = DEFAULT_PRIMARY_COLOR;

    // 1. Create sanitizer
    this.sanitizer = new Sanitizer({
      redactPatterns: privacyConfig.redactPatterns,
      sensitiveHeaders: privacyConfig.sensitiveHeaders,
      sensitiveParams: privacyConfig.sensitiveParams,
      maxBodySize: privacyConfig.maxBodySize,
      stripBodies: privacyConfig.stripBodies,
    });

    // 2. Create capture modules based on config flags
    // Each module is enabled by default (undefined) and only disabled with `false`

    // Console capture
    if (captureConfig.console !== false) {
      const opts =
        typeof captureConfig.console === 'object' ? captureConfig.console : {};
      const bufferSize = opts.maxItems ?? DEFAULT_BUFFER_SIZE;
      this.consoleCapture = createConsoleCapture(this.sanitizer, bufferSize);
      this.consoleCapture.start();
    }

    // Network capture
    if (captureConfig.network !== false) {
      const opts =
        typeof captureConfig.network === 'object' ? captureConfig.network : {};
      const bufferSize = opts.maxItems ?? DEFAULT_NETWORK_BUFFER_SIZE;
      this.networkCapture = createNetworkCapture(
        this.sanitizer,
        bufferSize,
        privacyConfig.maxBodySize,
      ) as NetworkCapture & { setExcludedEndpoint: (endpoint: string) => void };
      this.networkCapture.setExcludedEndpoint(this.config.endpoint);
      this.networkCapture.start();
    }

    // Breadcrumb capture
    if (captureConfig.breadcrumbs !== false) {
      const opts =
        typeof captureConfig.breadcrumbs === 'object'
          ? captureConfig.breadcrumbs
          : {};
      const bufferSize = opts.maxItems ?? DEFAULT_BREADCRUMB_BUFFER_SIZE;
      this.breadcrumbCapture = createBreadcrumbCapture(bufferSize);
      this.breadcrumbCapture.start();
    }

    // Screenshot capture
    if (captureConfig.screenshot !== false) {
      this.screenshotCapture = createScreenshotCapture();
    }

    // 3. Create transport
    this.transport = createTransport({
      endpoint: this.config.endpoint,
      auth: this.config.auth ?? { type: 'none' },
    });

    // 4. Create review modal
    this.modal = createReviewModal(uiConfig, this.translations, {
      onSubmit: async ({ report, screenshot }) => {
        // Enrich report with SDK-level context
        report.user = this.userContext;
        report.metadata = { ...this.metadata, ...report.metadata };
        report.sdk_version = SDK_VERSION;
        report.captured_at = new Date().toISOString();

        const result = await this.transport!.sendReport(report, screenshot);
        if (!result.success) {
          throw new Error(result.error?.message ?? 'Failed to send report');
        }
      },
      onCancel: () => {
        this.frozenErrorInfo = null;
      },
    });

    // 4b. Create chat manager if chat is enabled
    const chatConfig = this.config.chat ?? {};
    if (chatConfig.enabled !== false) {
      const auth = this.config.auth ?? { type: 'none' as const };
      this.chatMgr = createChatManager({
        endpoint: this.config.endpoint,
        auth,
        maxMessages: chatConfig.maxMessages ?? 20,
        locale: this.locale,
      });
      this.modal.setChatManager(this.chatMgr);

      // Check if the chat endpoint is available (on init, not on every open)
      void this.checkChatEndpoint();
    }

    // 5. Create toast
    this.toast = createToast({ primaryColor });

    // 6. Create error capture
    this.errorCapture = createErrorCapture();
    this.errorCapture.start((errorInfo: ErrorInfo) => {
      this.handleError(errorInfo);
    });

    // 7. Create trigger button
    if (uiConfig.showTrigger !== false) {
      this.trigger = createTriggerButton({
        position: uiConfig.triggerPosition ?? 'bottom-right',
        label: uiConfig.triggerLabel ?? this.translations.triggerLabel,
        primaryColor,
        onClick: () => this.triggerReport(),
      });
      this.trigger.mount();
    }
  }

  private async checkChatEndpoint(): Promise<void> {
    try {
      const auth = this.config.auth ?? { type: 'none' as const };
      const headers = await resolveAuthHeaders(auth);
      headers.set('Content-Type', 'application/json');

      const url = `${this.config.endpoint.replace(/\/+$/, '')}/chat`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [],
          diagnostic_context: null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        // Chat endpoint not available — fall back to textarea
        this.modal?.setChatEnabled(false);
        return;
      }

      // Chat endpoint is available (any non-404 response means it exists)
      this.modal?.setChatEnabled(true);

      // Consume the body to prevent connection hanging
      try {
        // Cancel the stream since this was just a probe
        if (response.body) {
          await response.body.cancel();
        }
      } catch {
        // ignore
      }
    } catch (err) {
      if (err instanceof ChatTransportError && err.status === 404) {
        this.modal?.setChatEnabled(false);
        return;
      }
      // Network errors or timeouts — fall back to textarea
      this.modal?.setChatEnabled(false);
    }
  }

  private async handleError(errorInfo: ErrorInfo): Promise<void> {
    if (this.destroyed) return;

    this.frozenErrorInfo = errorInfo;

    // Freeze buffers
    const consoleLogs = this.consoleCapture?.freeze();
    const networkLogs = this.networkCapture?.freeze();
    const breadcrumbs = this.breadcrumbCapture?.freeze();

    // Capture screenshot
    let screenshot: Blob | null = null;
    if (this.screenshotCapture) {
      screenshot = await this.screenshotCapture.capture();
    }

    // Collect browser info
    const browserInfo = collectBrowserInfo();

    // Show toast
    this.toast?.show({
      message: `Error detected: ${errorInfo.message}`,
      onAction: () => {
        // User clicked "Send report" — open modal with frozen data
        this.modal?.open({
          screenshot: screenshot ?? undefined,
          consoleLogs,
          networkLogs,
          browserInfo,
          breadcrumbs,
          errorInfo: this.frozenErrorInfo ?? undefined,
        });
      },
      onDismiss: () => {
        // Discard frozen data
        this.frozenErrorInfo = null;
      },
    });
  }

  triggerReport(options?: { description?: string }): void {
    if (this.destroyed) return;
    void this.doTriggerReport(options);
  }

  private async doTriggerReport(options?: {
    description?: string;
  }): Promise<void> {
    // 1. Freeze capture buffers
    const consoleLogs = this.consoleCapture?.freeze();
    const networkLogs = this.networkCapture?.freeze();
    const breadcrumbs = this.breadcrumbCapture?.freeze();

    // 2. Take screenshot
    let screenshot: Blob | null = null;
    if (this.screenshotCapture) {
      screenshot = await this.screenshotCapture.capture();
    }

    // 3. Collect browser info
    const browserInfo = collectBrowserInfo();

    // 4. Open review modal
    this.modal?.open({
      screenshot: screenshot ?? undefined,
      consoleLogs,
      networkLogs,
      browserInfo,
      breadcrumbs,
      errorInfo: this.frozenErrorInfo ?? undefined,
    });

    void options;
  }

  addBreadcrumb(crumb: {
    type: 'custom';
    message: string;
    data?: Record<string, unknown>;
  }): void {
    if (this.destroyed) return;
    this.breadcrumbCapture?.addBreadcrumb(crumb);
  }

  setUser(user: UserContext): void {
    if (this.destroyed) return;
    this.userContext = user;
  }

  setMetadata(metadata: Record<string, unknown>): void {
    if (this.destroyed) return;
    this.metadata = metadata;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Stop all capture modules
    this.consoleCapture?.stop();
    this.networkCapture?.stop();
    this.breadcrumbCapture?.stop();
    this.errorCapture?.stop();

    // Remove UI
    this.trigger?.unmount();
    this.modal?.destroy();
    this.toast?.destroy();
    this.chatMgr?.destroy();

    // Null out references
    this.consoleCapture = null;
    this.networkCapture = null;
    this.breadcrumbCapture = null;
    this.screenshotCapture = null;
    this.errorCapture = null;
    this.transport = null;
    this.modal = null;
    this.trigger = null;
    this.toast = null;
    this.chatMgr = null;
    this.sanitizer = null;
    this.frozenErrorInfo = null;

    // Clear singleton
    instance = null;
  }
}
