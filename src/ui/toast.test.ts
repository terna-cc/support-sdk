import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createToast } from './toast';

describe('createToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up any toast DOM elements
    document
      .querySelectorAll('[data-support-sdk-toast]')
      .forEach((el) => el.remove());
  });

  it('shows toast in Shadow DOM', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'An error occurred.', onAction, onDismiss });

    const host = document.querySelector('[data-support-sdk-toast]');
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();

    const container = host!.shadowRoot!.querySelector('.toast-container');
    expect(container).not.toBeNull();

    const messageEl = host!.shadowRoot!.querySelector('.toast-message');
    expect(messageEl).not.toBeNull();
    expect(messageEl!.textContent).toContain('An error occurred.');

    toast.destroy();
  });

  it('onAction callback fires on "Send report" click', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'Error', onAction, onDismiss });

    const host = document.querySelector('[data-support-sdk-toast]');
    const actionBtn = host!.shadowRoot!.querySelector(
      '[data-action="send"]',
    ) as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();

    actionBtn.click();

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    toast.destroy();
  });

  it('onDismiss callback fires on "Dismiss" click', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'Error', onAction, onDismiss });

    const host = document.querySelector('[data-support-sdk-toast]');
    const dismissBtn = host!.shadowRoot!.querySelector(
      '[data-action="dismiss"]',
    ) as HTMLButtonElement;
    expect(dismissBtn).not.toBeNull();

    dismissBtn.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();

    toast.destroy();
  });

  it('auto-dismisses after 15 seconds', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'Error', onAction, onDismiss });

    expect(onDismiss).not.toHaveBeenCalled();

    // Advance to just before auto-dismiss
    vi.advanceTimersByTime(14_999);
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance past auto-dismiss threshold
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    toast.destroy();
  });

  it('cancels auto-dismiss when "Send report" is clicked', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'Error', onAction, onDismiss });

    const host = document.querySelector('[data-support-sdk-toast]');
    const actionBtn = host!.shadowRoot!.querySelector(
      '[data-action="send"]',
    ) as HTMLButtonElement;

    actionBtn.click();

    // Advance past auto-dismiss time
    vi.advanceTimersByTime(20_000);

    // onDismiss should NOT have been called (auto-dismiss cancelled)
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledTimes(1);

    toast.destroy();
  });

  it('hide() removes toast container', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'Error', onAction, onDismiss });

    const host = document.querySelector('[data-support-sdk-toast]');
    expect(host!.shadowRoot!.querySelector('.toast-container')).not.toBeNull();

    toast.hide();

    // After hide, run timers for cleanup fallback
    vi.advanceTimersByTime(500);

    // Container should be removed
    expect(host!.shadowRoot!.querySelector('.toast-container')).toBeNull();

    toast.destroy();
  });

  it('destroy() cleans up completely', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({ message: 'Error', onAction, onDismiss });

    expect(
      document.querySelector('[data-support-sdk-toast]'),
    ).not.toBeNull();

    toast.destroy();

    expect(document.querySelector('[data-support-sdk-toast]')).toBeNull();
  });

  it('escapes HTML in message', () => {
    const toast = createToast({ primaryColor: '#007bff' });
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    toast.show({
      message: '<script>alert("xss")</script>',
      onAction,
      onDismiss,
    });

    const host = document.querySelector('[data-support-sdk-toast]');
    const messageEl = host!.shadowRoot!.querySelector('.toast-message');
    // The script tag should be escaped, not rendered
    expect(messageEl!.innerHTML).not.toContain('<script>');
    expect(messageEl!.textContent).toContain('<script>');

    toast.destroy();
  });

  it('can show multiple toasts (replaces previous)', () => {
    const toast = createToast({ primaryColor: '#007bff' });

    toast.show({
      message: 'First error',
      onAction: vi.fn(),
      onDismiss: vi.fn(),
    });

    toast.show({
      message: 'Second error',
      onAction: vi.fn(),
      onDismiss: vi.fn(),
    });

    const host = document.querySelector('[data-support-sdk-toast]');
    const containers =
      host!.shadowRoot!.querySelectorAll('.toast-container');
    expect(containers).toHaveLength(1);

    const messageEl = host!.shadowRoot!.querySelector('.toast-message');
    expect(messageEl!.textContent).toContain('Second error');

    toast.destroy();
  });
});
