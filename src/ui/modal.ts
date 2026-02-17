import { modalStyles, buildThemeVars } from './styles';
import type {
  UIConfig,
  ThemeConfig,
  ConsoleEntry,
  NetworkEntry,
  BrowserInfo,
  Breadcrumb,
  ErrorInfo,
  RageClick,
  DiagnosticReport,
  DiagnosticSnapshot,
  AttachmentMetadata,
  PerformanceMetrics,
} from '../types';
import type { ChatManager } from '../chat/chat-manager';
import type { AttachmentManager, Attachment } from '../chat/attachment-manager';
import { createChatView, type ChatView } from './chat-view';
import type { Translations } from '../i18n/translations';

// ─── Public interfaces ─────────────────────────────────────────────

export interface ModalData {
  screenshot?: Blob;
  consoleLogs?: ConsoleEntry[];
  networkLogs?: NetworkEntry[];
  browserInfo?: BrowserInfo;
  breadcrumbs?: Breadcrumb[];
  rageClicks?: RageClick[];
  errorInfo?: ErrorInfo;
  performanceMetrics?: PerformanceMetrics | null;
}

export interface ModalCallbacks {
  onSubmit: (data: {
    report: DiagnosticReport;
    screenshot?: Blob;
    attachments?: Attachment[];
  }) => Promise<void>;
  onCancel: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface ReviewModal {
  open(data: ModalData): void;
  close(): void;
  destroy(): void;
  setChatManager(manager: ChatManager | null): void;
  setChatEnabled(enabled: boolean): void;
  setAttachmentManager(manager: AttachmentManager | null): void;
}

// ─── Category definition ───────────────────────────────────────────

interface Category {
  key: string;
  label: string;
  count: number;
  renderDetail: (container: HTMLElement) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function text(content: string): Text {
  return document.createTextNode(content);
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return String(timestamp);
  }
}

// ─── Category renderers ────────────────────────────────────────────

function renderConsoleLogs(container: HTMLElement, logs: ConsoleEntry[]): void {
  for (const log of logs) {
    const entry = el('div', 'log-entry');
    const level = el('span', `log-level ${log.level}`);
    level.textContent = log.level;
    entry.appendChild(level);
    entry.appendChild(text(` ${formatTime(log.timestamp)} ${log.message}`));
    container.appendChild(entry);
  }
}

function renderNetworkLogs(container: HTMLElement, logs: NetworkEntry[]): void {
  for (const log of logs) {
    const entry = el('div', 'log-entry');
    const statusCode = log.status ?? 0;
    const statusClass = statusCode >= 200 && statusCode < 400 ? 'ok' : 'err';
    const status = el('span', `net-status ${statusClass}`);
    status.textContent = String(statusCode);
    entry.appendChild(status);
    const duration = log.duration != null ? ` ${log.duration}ms` : '';
    entry.appendChild(text(` ${log.method} ${log.url}${duration}`));
    container.appendChild(entry);
  }
}

function renderBrowserInfo(container: HTMLElement, info: BrowserInfo): void {
  const pairs: [string, string][] = [
    ['Browser', info.browser],
    ['OS', info.os],
    ['Language', info.language],
    ['Platform', info.platform],
    ['Timezone', info.timezone],
    ['Online', String(info.online)],
    ['Screen', `${info.screenWidth}x${info.screenHeight}`],
    ['Viewport', `${info.viewportWidth}x${info.viewportHeight}`],
    ['DPR', String(info.devicePixelRatio)],
    ['URL', info.url],
  ];
  for (const [key, value] of pairs) {
    const row = el('div', 'kv-row');
    const keyEl = el('span', 'kv-key');
    keyEl.textContent = key + ':';
    const valueEl = el('span', 'kv-value');
    valueEl.textContent = value;
    row.appendChild(keyEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }
}

function renderBreadcrumbs(
  container: HTMLElement,
  breadcrumbs: Breadcrumb[],
): void {
  for (const bc of breadcrumbs) {
    const entry = el('div', 'breadcrumb-entry');
    const typeEl = el('span', 'breadcrumb-type');
    typeEl.textContent = bc.type;
    entry.appendChild(typeEl);
    entry.appendChild(text(` ${formatTime(bc.timestamp)} ${bc.message}`));
    container.appendChild(entry);
  }
}

// ─── Focus trap ────────────────────────────────────────────────────

function trapFocus(root: HTMLElement): () => void {
  function getFocusable(): HTMLElement[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    const focusable = getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (
        root.shadowRoot?.activeElement === first ||
        document.activeElement === first
      ) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (
        root.shadowRoot?.activeElement === last ||
        document.activeElement === last
      ) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  root.addEventListener('keydown', handleKeydown);
  return () => root.removeEventListener('keydown', handleKeydown);
}

// ─── Main factory ──────────────────────────────────────────────────

export function createReviewModal(
  config: UIConfig,
  translations: Translations,
  callbacks: ModalCallbacks,
  theme?: ThemeConfig,
): ReviewModal {
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let removeTrap: (() => void) | null = null;
  let currentData: ModalData | null = null;

  // Chat mode support
  let chatManager: ChatManager | null = null;
  let chatEnabled = false;
  let chatView: ChatView | null = null;

  // Attachment support
  let attachmentMgr: AttachmentManager | null = null;

  // Track checkbox state per category key
  const checkedState = new Map<string, boolean>();

  function buildCategories(data: ModalData): Category[] {
    const cats: Category[] = [];

    if (data.screenshot) {
      cats.push({
        key: 'screenshot',
        label: 'Screenshot',
        count: 1,
        renderDetail: () => {
          // Screenshot detail is shown via the thumbnail — no extra detail panel
        },
      });
    }

    if (data.consoleLogs && data.consoleLogs.length > 0) {
      cats.push({
        key: 'console',
        label: 'Console logs',
        count: data.consoleLogs.length,
        renderDetail: (container) =>
          renderConsoleLogs(container, data.consoleLogs!),
      });
    }

    if (data.networkLogs && data.networkLogs.length > 0) {
      cats.push({
        key: 'network',
        label: 'Network activity',
        count: data.networkLogs.length,
        renderDetail: (container) =>
          renderNetworkLogs(container, data.networkLogs!),
      });
    }

    if (data.browserInfo) {
      cats.push({
        key: 'browser',
        label: 'Browser info',
        count: 1,
        renderDetail: (container) =>
          renderBrowserInfo(container, data.browserInfo!),
      });
    }

    if (data.breadcrumbs && data.breadcrumbs.length > 0) {
      cats.push({
        key: 'breadcrumbs',
        label: 'Recent actions',
        count: data.breadcrumbs.length,
        renderDetail: (container) =>
          renderBreadcrumbs(container, data.breadcrumbs!),
      });
    }

    return cats;
  }

  function buildReport(data: ModalData, description: string): DiagnosticReport {
    return {
      description,
      console:
        checkedState.get('console') && data.consoleLogs ? data.consoleLogs : [],
      network:
        checkedState.get('network') && data.networkLogs ? data.networkLogs : [],
      breadcrumbs:
        checkedState.get('breadcrumbs') && data.breadcrumbs
          ? data.breadcrumbs
          : [],
      browser:
        checkedState.get('browser') && data.browserInfo
          ? data.browserInfo
          : {
              userAgent: '',
              browser: '',
              os: '',
              language: '',
              platform: '',
              timezone: '',
              online: false,
              screenWidth: 0,
              screenHeight: 0,
              viewportWidth: 0,
              viewportHeight: 0,
              devicePixelRatio: 0,
              url: '',
              referrer: '',
            },
      screenshot: null, // Blob is sent separately
      errors: data.errorInfo ? [data.errorInfo] : [],
      rageClicks: data.rageClicks ?? [],
      performance: data.performanceMetrics ?? null,
      user: null,
      metadata: {},
      sdk_version: '',
      captured_at: new Date().toISOString(),
      timestamp: Date.now(),
    };
  }

  function hasAnyChecked(): boolean {
    for (const v of checkedState.values()) {
      if (v) return true;
    }
    return false;
  }

  function updateSendButton(sendBtn: HTMLButtonElement): void {
    sendBtn.disabled = !hasAnyChecked();
  }

  function buildDiagnosticSnapshot(data: ModalData): DiagnosticSnapshot {
    return {
      errors: data.errorInfo ? [data.errorInfo] : [],
      failedRequests: (data.networkLogs ?? []).filter(
        (r) => r.status !== null && (r.status === 0 || r.status >= 400),
      ),
      consoleErrors: (data.consoleLogs ?? []).filter(
        (l) => l.level === 'error',
      ),
      breadcrumbs: data.breadcrumbs ?? [],
      rageClicks: data.rageClicks ?? [],
      browser: data.browserInfo ?? {
        userAgent: '',
        browser: '',
        os: '',
        language: '',
        platform: '',
        timezone: '',
        online: false,
        screenWidth: 0,
        screenHeight: 0,
        viewportWidth: 0,
        viewportHeight: 0,
        devicePixelRatio: 0,
        url: '',
        referrer: '',
      },
      currentUrl: data.browserInfo?.url ?? window.location.href,
      performance: data.performanceMetrics ?? null,
    };
  }

  function openChatMode(
    data: ModalData,
    manager: ChatManager,
    closeFn: () => void,
    cancelFn: () => void,
  ): { content: HTMLElement; onMount: () => void } {
    // In chat mode there are no category checkboxes, so mark all
    // available categories as included so buildReport() sends full data.
    if (data.screenshot) checkedState.set('screenshot', true);
    if (data.consoleLogs && data.consoleLogs.length > 0)
      checkedState.set('console', true);
    if (data.networkLogs && data.networkLogs.length > 0)
      checkedState.set('network', true);
    if (data.browserInfo) checkedState.set('browser', true);
    if (data.breadcrumbs && data.breadcrumbs.length > 0)
      checkedState.set('breadcrumbs', true);

    const content = el('div', 'modal-content');

    // ── Header ──
    const header = el('div', 'modal-header');
    const title = el('span', 'modal-title');
    title.textContent = config.modalTitle ?? translations.modalTitle;
    const closeBtn = el('button', 'modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    const closeSvg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    closeSvg.setAttribute('width', '20');
    closeSvg.setAttribute('height', '20');
    closeSvg.setAttribute('viewBox', '0 0 20 20');
    closeSvg.setAttribute('fill', 'currentColor');
    const closePath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    closePath.setAttribute(
      'd',
      'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z',
    );
    closeSvg.appendChild(closePath);
    closeBtn.appendChild(closeSvg);
    header.appendChild(title);
    header.appendChild(closeBtn);
    content.appendChild(header);

    closeBtn.addEventListener('click', () => {
      closeFn();
      cancelFn();
    });

    // ── Chat View ──
    chatView = createChatView(
      manager,
      {
        onSubmit: async ({ description, conversation, aiSummary }) => {
          if (!currentData) return;

          const report = buildReport(currentData, description);
          // Enrich with conversation and summary
          report.metadata = {
            ...report.metadata,
            conversation: conversation as unknown as Record<string, unknown>[],
            ai_summary: aiSummary as unknown as Record<string, unknown>,
          };

          // Include attachment metadata in the report
          const chatAttachments =
            chatView?.getAttachmentManager()?.getAll() ?? [];
          if (chatAttachments.length > 0) {
            report.attachments = chatAttachments.map(
              (a): AttachmentMetadata => ({
                name: a.name,
                size: a.size,
                type: a.type,
              }),
            );
          }

          const screenshot =
            checkedState.get('screenshot') && currentData.screenshot
              ? currentData.screenshot
              : undefined;

          await callbacks.onSubmit({
            report,
            screenshot,
            attachments:
              chatAttachments.length > 0 ? chatAttachments : undefined,
          });

          // Close after brief delay on success
          setTimeout(() => closeFn(), 1500);
        },
        onCancel: () => {
          closeFn();
          cancelFn();
        },
        onKeepChatting: () => {
          if (chatView) {
            chatView.showChat();
            chatView.showTypingIndicator();
            manager.sendMessage("I'd like to adjust the summary");
          }
        },
      },
      translations,
      attachmentMgr ?? undefined,
    );

    content.appendChild(chatView.getContainer());

    // Wire up chat manager callbacks
    manager.onTextChunk((chunk) => {
      chatView?.addAssistantChunk(chunk);
      chatView?.setInputEnabled(false);
    });

    manager.onSummary((summary) => {
      chatView?.finalizeAssistantMessage();
      chatView?.hideThinking();
      chatView?.hideTypingIndicator();
      chatView?.showSummary(summary);
    });

    manager.onDone(() => {
      chatView?.finalizeAssistantMessage();
      chatView?.hideThinking();
      chatView?.hideTypingIndicator();
      chatView?.setInputEnabled(true);
    });

    manager.onError(() => {
      chatView?.hideThinking();
      chatView?.hideTypingIndicator();
      chatView?.finalizeAssistantMessage();
      chatView?.setInputEnabled(true);
      chatView?.showChatError(translations.errorMessage, () => {
        chatView?.showThinking();
        chatView?.setInputEnabled(false);
        manager.retry();
      });
    });

    // Start the chat
    const snapshot = buildDiagnosticSnapshot(data);

    return {
      content,
      onMount: () => {
        chatView?.showThinking();
        manager.start(snapshot);
        closeBtn.focus();
      },
    };
  }

  function open(data: ModalData): void {
    if (host) close();
    currentData = data;
    checkedState.clear();

    host = document.createElement('div');
    host.setAttribute('data-support-modal', '');
    shadow = host.attachShadow({ mode: 'open' });

    // Styles (theme vars + modal styles)
    const style = document.createElement('style');
    style.textContent = buildThemeVars(theme) + modalStyles;
    shadow.appendChild(style);

    // Position class based on triggerPosition config
    const position = config.triggerPosition ?? 'bottom-right';

    // Container (no backdrop overlay — page stays interactive)
    const backdrop = el('div', 'modal-backdrop');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'false');
    backdrop.setAttribute(
      'aria-label',
      config.modalTitle ?? translations.modalTitle,
    );

    // Determine mode: chat or classic textarea
    const useChatMode = chatEnabled && chatManager !== null;

    if (useChatMode) {
      const { content, onMount } = openChatMode(
        data,
        chatManager!,
        () => close(),
        () => callbacks.onCancel(),
      );

      // Apply position class to content
      content.classList.add(position);

      // Escape key handler
      const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          close();
          callbacks.onCancel();
        }
      };

      backdrop.appendChild(content);
      shadow.appendChild(backdrop);

      document.body.appendChild(host);
      removeTrap = trapFocus(content);
      content.addEventListener('keydown', handleEscape);
      callbacks.onOpen?.();

      onMount();
      return;
    }

    // ── Classic textarea mode ──

    // Content container
    const content = el('div', `modal-content ${position}`);

    // ── Header ──
    const header = el('div', 'modal-header');
    const title = el('span', 'modal-title');
    title.textContent = config.modalTitle ?? translations.modalTitle;
    const closeBtn = el('button', 'modal-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    // Close icon (×)
    const closeSvg = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    closeSvg.setAttribute('width', '20');
    closeSvg.setAttribute('height', '20');
    closeSvg.setAttribute('viewBox', '0 0 20 20');
    closeSvg.setAttribute('fill', 'currentColor');
    const closePath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path',
    );
    closePath.setAttribute(
      'd',
      'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z',
    );
    closeSvg.appendChild(closePath);
    closeBtn.appendChild(closeSvg);
    header.appendChild(title);
    header.appendChild(closeBtn);
    content.appendChild(header);

    // ── Body ──
    const body = el('div', 'modal-body');

    // Screenshot preview
    if (data.screenshot) {
      checkedState.set('screenshot', true);
      const previewContainer = el('div', 'screenshot-preview');
      const img = document.createElement('img');
      img.alt = 'Screenshot preview';
      const objectUrl = URL.createObjectURL(data.screenshot);
      img.src = objectUrl;

      previewContainer.addEventListener('click', () => {
        const overlay = el('div', 'screenshot-overlay');
        const fullImg = document.createElement('img');
        fullImg.alt = 'Full screenshot';
        fullImg.src = objectUrl;
        overlay.appendChild(fullImg);
        overlay.addEventListener('click', () => overlay.remove());
        shadow!.appendChild(overlay);
      });

      previewContainer.appendChild(img);
      body.appendChild(previewContainer);
    }

    // Description field
    const descLabel = el('label', 'field-label');
    descLabel.textContent = 'What went wrong? (optional)';
    descLabel.setAttribute('for', 'support-description');
    body.appendChild(descLabel);

    const textarea = el('textarea', 'description-textarea');
    textarea.id = 'support-description';
    textarea.placeholder = 'Describe the issue you encountered...';
    textarea.rows = 3;
    body.appendChild(textarea);

    // Section heading
    const sectionTitle = el('div', 'section-heading');
    sectionTitle.textContent = 'Data included in this report:';
    body.appendChild(sectionTitle);

    // Category list
    const categories = buildCategories(data);
    const categoryList = el('div', 'category-list');

    // We'll capture a reference to the send button to update its state
    let sendBtn: HTMLButtonElement | null = null;

    for (const cat of categories) {
      checkedState.set(cat.key, true);

      const wrapper = el('div');

      // Row
      const row = el('div', 'category-row');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'category-checkbox';
      checkbox.checked = true;
      checkbox.id = `cat-${cat.key}`;
      checkbox.setAttribute('aria-label', `Include ${cat.label}`);

      const label = el('label', 'category-label');
      label.setAttribute('for', `cat-${cat.key}`);
      label.textContent = cat.label;

      const count = el('span', 'category-count');
      count.textContent =
        cat.count > 1 ? `(${cat.count} entries)` : '(1 entry)';

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(count);

      // View toggle button (skip for screenshot — it uses the thumbnail)
      const detail = el('div', 'category-detail');
      detail.setAttribute('data-category', cat.key);

      if (cat.key !== 'screenshot') {
        const viewBtn = el('button', 'category-view-btn');
        viewBtn.type = 'button';
        viewBtn.textContent = 'View';
        viewBtn.setAttribute('aria-expanded', 'false');
        viewBtn.addEventListener('click', () => {
          const isExpanded = detail.classList.contains('expanded');
          if (isExpanded) {
            detail.classList.remove('expanded');
            viewBtn.textContent = 'View';
            viewBtn.setAttribute('aria-expanded', 'false');
          } else {
            // Render content lazily on first expand
            if (detail.children.length === 0) {
              cat.renderDetail(detail);
            }
            detail.classList.add('expanded');
            viewBtn.textContent = 'Hide';
            viewBtn.setAttribute('aria-expanded', 'true');
          }
        });
        row.appendChild(viewBtn);
      }

      wrapper.appendChild(row);
      wrapper.appendChild(detail);

      checkbox.addEventListener('change', () => {
        checkedState.set(cat.key, checkbox.checked);
        if (sendBtn) updateSendButton(sendBtn);
      });

      categoryList.appendChild(wrapper);
    }

    body.appendChild(categoryList);

    // Status message area
    const statusArea = el('div');
    statusArea.setAttribute('data-status', '');
    statusArea.setAttribute('role', 'status');
    statusArea.setAttribute('aria-live', 'polite');
    body.appendChild(statusArea);

    content.appendChild(body);

    // ── Footer ──
    const footer = el('div', 'modal-footer');
    const cancelBtn = el('button', 'btn btn-secondary');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';

    sendBtn = el('button', 'btn btn-primary');
    sendBtn.type = 'button';
    sendBtn.textContent = 'Send Report';
    updateSendButton(sendBtn);

    // Cancel handler
    cancelBtn.addEventListener('click', () => {
      close();
      callbacks.onCancel();
    });

    // Close button handler
    closeBtn.addEventListener('click', () => {
      close();
      callbacks.onCancel();
    });

    // Submit handler
    sendBtn.addEventListener('click', async () => {
      if (!sendBtn || !currentData) return;

      // Show spinner
      sendBtn.disabled = true;
      const originalText = sendBtn.textContent;
      sendBtn.textContent = '';
      const spinner = el('span', 'spinner');
      sendBtn.appendChild(spinner);
      sendBtn.appendChild(text(' Sending...'));

      // Clear previous status
      statusArea.textContent = '';

      try {
        const report = buildReport(currentData, textarea.value);
        const screenshot =
          checkedState.get('screenshot') && currentData.screenshot
            ? currentData.screenshot
            : undefined;

        await callbacks.onSubmit({ report, screenshot });

        // Success
        const successMsg = el('div', 'status-message success');
        successMsg.textContent = 'Report sent!';
        statusArea.appendChild(successMsg);

        // Close after brief delay
        setTimeout(() => close(), 1500);
      } catch (err) {
        // Error
        const errorMsg = el('div', 'status-message error');
        errorMsg.textContent =
          err instanceof Error ? err.message : 'Failed to send report';
        statusArea.appendChild(errorMsg);

        // Restore button
        sendBtn.textContent = originalText;
        sendBtn.disabled = !hasAnyChecked();
      }
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(sendBtn);
    content.appendChild(footer);

    // Escape key handler
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close();
        callbacks.onCancel();
      }
    };

    backdrop.appendChild(content);
    shadow.appendChild(backdrop);

    // Mount (no body scroll lock — page stays interactive)
    document.body.appendChild(host);
    removeTrap = trapFocus(content);

    // Listen for Escape on the content element (inside shadow DOM)
    content.addEventListener('keydown', handleEscape);
    callbacks.onOpen?.();

    // Focus the close button initially
    closeBtn.focus();
  }

  function close(): void {
    if (chatView) {
      chatView.destroy();
      chatView = null;
    }
    if (chatManager) {
      chatManager.abort();
    }
    if (removeTrap) {
      removeTrap();
      removeTrap = null;
    }
    if (host) {
      host.remove();
      host = null;
      shadow = null;
    }
    currentData = null;
    checkedState.clear();
    callbacks.onClose?.();
  }

  function destroy(): void {
    close();
  }

  function setChatManager(manager: ChatManager | null): void {
    chatManager = manager;
  }

  function setChatEnabled(enabled: boolean): void {
    chatEnabled = enabled;
  }

  function setAttachmentManager(manager: AttachmentManager | null): void {
    attachmentMgr = manager;
  }

  return {
    open,
    close,
    destroy,
    setChatManager,
    setChatEnabled,
    setAttachmentManager,
  };
}
