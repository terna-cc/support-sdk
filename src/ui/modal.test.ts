import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReviewModal } from './modal';
import type { ModalData, ModalCallbacks } from './modal';
import type {
  UIConfig,
  ConsoleEntry,
  NetworkEntry,
  BrowserInfo,
  Breadcrumb,
} from '../types';

// Mock URL.createObjectURL since jsdom doesn't support it
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function makeBrowserInfo(overrides?: Partial<BrowserInfo>): BrowserInfo {
  return {
    userAgent: 'test-agent',
    browser: 'Chrome 120',
    os: 'macOS 14',
    language: 'en-US',
    platform: 'MacIntel',
    timezone: 'America/New_York',
    online: true,
    screenWidth: 1920,
    screenHeight: 1080,
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    url: 'https://example.com',
    referrer: '',
    ...overrides,
  };
}

function makeConsoleLogs(count: number): ConsoleEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    level: 'error' as const,
    message: `Error ${i}`,
    args: [],
    timestamp: Date.now() - (count - i) * 1000,
  }));
}

function makeNetworkLogs(count: number): NetworkEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    method: 'GET',
    url: `https://api.example.com/items/${i}`,
    status: i % 3 === 0 ? 500 : 200,
    requestHeaders: {},
    responseHeaders: {},
    requestBody: null,
    responseBody: null,
    duration: 100 + i * 10,
    timestamp: Date.now() - (count - i) * 1000,
  }));
}

function makeBreadcrumbs(count: number): Breadcrumb[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'click' as const,
    message: `Clicked button ${i}`,
    timestamp: Date.now() - (count - i) * 1000,
  }));
}

function getHost(): HTMLElement | null {
  return document.querySelector('[data-support-modal]');
}

function getShadow(): ShadowRoot | null {
  return getHost()?.shadowRoot ?? null;
}

describe('createReviewModal', () => {
  let config: UIConfig;
  let callbacks: ModalCallbacks;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    config = {
      triggerPosition: 'bottom-right',
      triggerLabel: 'Report Issue',
      modalTitle: 'Send Diagnostic Report',
      showTrigger: true,
    };

    onSubmit = vi.fn().mockResolvedValue(undefined);
    onCancel = vi.fn();
    callbacks = { onSubmit, onCancel };
  });

  afterEach(() => {
    // Clean up any mounted modals
    document
      .querySelectorAll('[data-support-modal]')
      .forEach((el) => el.remove());
    document.body.style.overflow = '';
  });

  it('mounts inside Shadow DOM when opened', () => {
    const modal = createReviewModal(config, callbacks);
    const data: ModalData = {
      consoleLogs: makeConsoleLogs(3),
    };

    modal.open(data);

    const host = getHost();
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();
  });

  it('injects styles into Shadow DOM', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const style = getShadow()!.querySelector('style');
    expect(style).not.toBeNull();
    expect(style!.textContent).toContain('.modal-backdrop');
  });

  it('displays modal title', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const title = getShadow()!.querySelector('.modal-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Send Diagnostic Report');
  });

  it('displays custom modal title', () => {
    config.modalTitle = 'Custom Title';
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const title = getShadow()!.querySelector('.modal-title');
    expect(title!.textContent).toBe('Custom Title');
  });

  it('renders category checkboxes for provided data', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(5),
      networkLogs: makeNetworkLogs(3),
      browserInfo: makeBrowserInfo(),
      breadcrumbs: makeBreadcrumbs(2),
    });

    const checkboxes = getShadow()!.querySelectorAll('.category-checkbox');
    expect(checkboxes.length).toBe(4); // console, network, browser, breadcrumbs
  });

  it('all checkboxes are checked by default', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(5),
      networkLogs: makeNetworkLogs(3),
    });

    const checkboxes = getShadow()!.querySelectorAll(
      '.category-checkbox',
    ) as NodeListOf<HTMLInputElement>;
    for (const cb of checkboxes) {
      expect(cb.checked).toBe(true);
    }
  });

  it('category checkboxes toggle inclusion', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(5),
      networkLogs: makeNetworkLogs(3),
    });

    const checkboxes = getShadow()!.querySelectorAll(
      '.category-checkbox',
    ) as NodeListOf<HTMLInputElement>;
    const firstCheckbox = checkboxes[0];

    // Uncheck
    firstCheckbox.checked = false;
    firstCheckbox.dispatchEvent(new Event('change'));
    expect(firstCheckbox.checked).toBe(false);

    // Re-check
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent(new Event('change'));
    expect(firstCheckbox.checked).toBe(true);
  });

  it('shows entry count for categories', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(23),
      networkLogs: makeNetworkLogs(12),
      breadcrumbs: makeBreadcrumbs(8),
    });

    const counts = getShadow()!.querySelectorAll('.category-count');
    expect(counts[0].textContent).toBe('(23 entries)');
    expect(counts[1].textContent).toBe('(12 entries)');
    expect(counts[2].textContent).toBe('(8 entries)');
  });

  it('send button is disabled when no categories are checked', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(1),
    });

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);

    // Uncheck the only checkbox
    const checkbox = getShadow()!.querySelector(
      '.category-checkbox',
    ) as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    expect(sendBtn.disabled).toBe(true);
  });

  it('send button is enabled when at least one category is checked', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(1),
      networkLogs: makeNetworkLogs(1),
    });

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    const checkboxes = getShadow()!.querySelectorAll(
      '.category-checkbox',
    ) as NodeListOf<HTMLInputElement>;

    // Uncheck first
    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event('change'));

    // Still enabled because second is checked
    expect(sendBtn.disabled).toBe(false);
  });

  it('onSubmit called with correct report shape', async () => {
    const modal = createReviewModal(config, callbacks);
    const consoleLogs = makeConsoleLogs(3);
    const networkLogs = makeNetworkLogs(2);
    const browserInfo = makeBrowserInfo();
    modal.open({ consoleLogs, networkLogs, browserInfo });

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    sendBtn.click();

    // Wait for the async handler
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const callArg = onSubmit.mock.calls[0][0];
    expect(callArg.report).toBeDefined();
    expect(callArg.report.console).toEqual(consoleLogs);
    expect(callArg.report.network).toEqual(networkLogs);
    expect(callArg.report.browser).toEqual(browserInfo);
    expect(callArg.report.description).toBe('');
    expect(callArg.report.timestamp).toBeGreaterThan(0);
  });

  it('onSubmit excludes unchecked categories', async () => {
    const modal = createReviewModal(config, callbacks);
    const consoleLogs = makeConsoleLogs(3);
    const networkLogs = makeNetworkLogs(2);
    modal.open({ consoleLogs, networkLogs });

    // Uncheck console logs (first checkbox)
    const checkboxes = getShadow()!.querySelectorAll(
      '.category-checkbox',
    ) as NodeListOf<HTMLInputElement>;
    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event('change'));

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    sendBtn.click();

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const report = onSubmit.mock.calls[0][0].report;
    expect(report.console).toEqual([]); // Excluded
    expect(report.network).toEqual(networkLogs); // Included
  });

  it('includes screenshot Blob when screenshot category is checked', async () => {
    const modal = createReviewModal(config, callbacks);
    const screenshot = new Blob(['test'], { type: 'image/png' });
    modal.open({ screenshot, consoleLogs: makeConsoleLogs(1) });

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    sendBtn.click();

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0][0].screenshot).toBe(screenshot);
  });

  it('onCancel called when cancel button is clicked', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const cancelBtn = getShadow()!.querySelector(
      '.btn-secondary',
    ) as HTMLButtonElement;
    cancelBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('onCancel called when close button (X) is clicked', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const closeBtn = getShadow()!.querySelector(
      '.modal-close',
    ) as HTMLButtonElement;
    closeBtn.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('onCancel called when Escape is pressed', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const backdrop = getShadow()!.querySelector(
      '.modal-backdrop',
    ) as HTMLElement;
    backdrop.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('view toggle expands and collapses sections', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(3) });

    const viewBtn = getShadow()!.querySelector(
      '.category-view-btn',
    ) as HTMLButtonElement;
    const detail = getShadow()!.querySelector(
      '.category-detail',
    ) as HTMLElement;

    expect(detail.classList.contains('expanded')).toBe(false);
    expect(viewBtn.textContent).toBe('View');

    // Expand
    viewBtn.click();
    expect(detail.classList.contains('expanded')).toBe(true);
    expect(viewBtn.textContent).toBe('Hide');
    expect(viewBtn.getAttribute('aria-expanded')).toBe('true');

    // Collapse
    viewBtn.click();
    expect(detail.classList.contains('expanded')).toBe(false);
    expect(viewBtn.textContent).toBe('View');
    expect(viewBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders console log details when expanded', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: [
        { level: 'error', message: 'Test error', args: [], timestamp: 1000 },
        { level: 'warn', message: 'Test warn', args: [], timestamp: 2000 },
      ],
    });

    const viewBtn = getShadow()!.querySelector(
      '.category-view-btn',
    ) as HTMLButtonElement;
    viewBtn.click();

    const detail = getShadow()!.querySelector(
      '.category-detail',
    ) as HTMLElement;
    const entries = detail.querySelectorAll('.log-entry');
    expect(entries.length).toBe(2);

    const levels = detail.querySelectorAll('.log-level');
    expect(levels[0].textContent).toBe('error');
    expect(levels[1].textContent).toBe('warn');
  });

  it('renders network log details when expanded', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      networkLogs: [
        {
          method: 'POST',
          url: 'https://api.example.com/data',
          status: 201,
          requestHeaders: {},
          responseHeaders: {},
          requestBody: null,
          responseBody: null,
          duration: 150,
          timestamp: 1000,
        },
      ],
    });

    const viewBtn = getShadow()!.querySelector(
      '.category-view-btn',
    ) as HTMLButtonElement;
    viewBtn.click();

    const detail = getShadow()!.querySelector(
      '.category-detail',
    ) as HTMLElement;
    const status = detail.querySelector('.net-status') as HTMLElement;
    expect(status.textContent).toBe('201');
    expect(status.classList.contains('ok')).toBe(true);
  });

  it('renders browser info when expanded', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ browserInfo: makeBrowserInfo() });

    const viewBtn = getShadow()!.querySelector(
      '.category-view-btn',
    ) as HTMLButtonElement;
    viewBtn.click();

    const detail = getShadow()!.querySelector(
      '.category-detail',
    ) as HTMLElement;
    const rows = detail.querySelectorAll('.kv-row');
    expect(rows.length).toBeGreaterThan(0);

    const firstKey = rows[0].querySelector('.kv-key');
    expect(firstKey!.textContent).toBe('Browser:');
    const firstValue = rows[0].querySelector('.kv-value');
    expect(firstValue!.textContent).toBe('Chrome 120');
  });

  it('renders breadcrumbs when expanded', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      breadcrumbs: [
        {
          type: 'click',
          message: 'Clicked save',
          timestamp: 1000,
        },
      ],
    });

    const viewBtn = getShadow()!.querySelector(
      '.category-view-btn',
    ) as HTMLButtonElement;
    viewBtn.click();

    const detail = getShadow()!.querySelector(
      '.category-detail',
    ) as HTMLElement;
    const entries = detail.querySelectorAll('.breadcrumb-entry');
    expect(entries.length).toBe(1);

    const type = entries[0].querySelector('.breadcrumb-type');
    expect(type!.textContent).toBe('click');
  });

  it('close() removes modal from DOM', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    expect(getHost()).not.toBeNull();

    modal.close();

    expect(getHost()).toBeNull();
  });

  it('destroy() removes modal from DOM', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    expect(getHost()).not.toBeNull();

    modal.destroy();

    expect(getHost()).toBeNull();
  });

  it('locks body scroll when open and restores on close', () => {
    document.body.style.overflow = '';
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    expect(document.body.style.overflow).toBe('hidden');

    modal.close();

    expect(document.body.style.overflow).toBe('');
  });

  it('renders textarea for description', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const textarea = getShadow()!.querySelector(
      '.description-textarea',
    ) as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.placeholder).toContain('Describe');
  });

  it('includes description text in submitted report', async () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const textarea = getShadow()!.querySelector(
      '.description-textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'Something broke';

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    sendBtn.click();

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0][0].report.description).toBe(
      'Something broke',
    );
  });

  it('shows error message when onSubmit rejects', async () => {
    onSubmit.mockRejectedValueOnce(new Error('Network failure'));

    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    sendBtn.click();

    await vi.waitFor(() => {
      const statusMsg = getShadow()!.querySelector('.status-message.error');
      expect(statusMsg).not.toBeNull();
      expect(statusMsg!.textContent).toBe('Network failure');
    });
  });

  it('shows success message after successful submission', async () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const sendBtn = getShadow()!.querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    sendBtn.click();

    await vi.waitFor(() => {
      const statusMsg = getShadow()!.querySelector('.status-message.success');
      expect(statusMsg).not.toBeNull();
      expect(statusMsg!.textContent).toBe('Report sent!');
    });
  });

  it('sets role=dialog and aria-modal on backdrop', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const backdrop = getShadow()!.querySelector(
      '.modal-backdrop',
    ) as HTMLElement;
    expect(backdrop.getAttribute('role')).toBe('dialog');
    expect(backdrop.getAttribute('aria-modal')).toBe('true');
  });

  it('does not show screenshot section when no screenshot provided', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({ consoleLogs: makeConsoleLogs(1) });

    const preview = getShadow()!.querySelector('.screenshot-preview');
    expect(preview).toBeNull();
  });

  it('shows screenshot preview when screenshot provided', () => {
    const modal = createReviewModal(config, callbacks);
    const screenshot = new Blob(['test'], { type: 'image/png' });
    modal.open({ screenshot, consoleLogs: makeConsoleLogs(1) });

    const preview = getShadow()!.querySelector('.screenshot-preview');
    expect(preview).not.toBeNull();

    const img = preview!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('blob:mock-url');
  });

  it('only renders categories for data that is present', () => {
    const modal = createReviewModal(config, callbacks);
    modal.open({
      consoleLogs: makeConsoleLogs(3),
      // No network, no browser, no breadcrumbs
    });

    const checkboxes = getShadow()!.querySelectorAll('.category-checkbox');
    expect(checkboxes.length).toBe(1); // Only console
  });
});
