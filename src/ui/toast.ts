export interface ToastConfig {
  primaryColor: string;
}

export interface ToastShowOptions {
  message: string;
  onAction: () => void;
  onDismiss: () => void;
}

export interface Toast {
  show(options: ToastShowOptions): void;
  hide(): void;
  destroy(): void;
}

const AUTO_DISMISS_MS = 15_000;

function getToastStyles(primaryColor: string): string {
  return `
    :host {
      all: initial;
    }

    .toast-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100%);
      z-index: 2147483647;
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .toast-container.visible {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .toast-container {
        transition: none;
      }
    }

    .toast {
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 280px;
      max-width: 400px;
    }

    .toast-message {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      line-height: 1.4;
    }

    .toast-icon {
      flex-shrink: 0;
      font-size: 16px;
    }

    .toast-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .toast-btn {
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .toast-btn:hover {
      opacity: 0.85;
    }

    .toast-btn-action {
      background: ${primaryColor};
      color: #fff;
    }

    .toast-btn-dismiss {
      background: transparent;
      color: #999;
      border: 1px solid #444;
    }

    .toast-btn-dismiss:hover {
      color: #ccc;
      border-color: #666;
    }
  `;
}

export function createToast(config: ToastConfig): Toast {
  let host: HTMLDivElement | null = null;
  let shadowRoot: ShadowRoot | null = null;
  let container: HTMLDivElement | null = null;
  let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function ensureHost(): { shadow: ShadowRoot; wrapper: HTMLDivElement } {
    if (host && shadowRoot) {
      return { shadow: shadowRoot, wrapper: host };
    }

    host = document.createElement('div');
    host.setAttribute('data-support-sdk-toast', '');
    shadowRoot = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getToastStyles(config.primaryColor);
    shadowRoot.appendChild(style);

    document.body.appendChild(host);

    return { shadow: shadowRoot, wrapper: host };
  }

  function clearAutoDismiss(): void {
    if (autoDismissTimer !== null) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
  }

  function show(options: ToastShowOptions): void {
    const { shadow } = ensureHost();
    // Remove any existing toast content
    if (container) {
      container.remove();
    }

    container = document.createElement('div');
    container.className = 'toast-container';
    container.innerHTML = `
      <div class="toast">
        <div class="toast-message">
          <span class="toast-icon">\u26A0</span>
          <span>${escapeHtml(options.message)}</span>
        </div>
        <div class="toast-actions">
          <button class="toast-btn toast-btn-action" data-action="send">Send report</button>
          <button class="toast-btn toast-btn-dismiss" data-action="dismiss">Dismiss</button>
        </div>
      </div>
    `;

    const actionBtn = container.querySelector('[data-action="send"]')!;
    const dismissBtn = container.querySelector('[data-action="dismiss"]')!;

    actionBtn.addEventListener('click', () => {
      clearAutoDismiss();
      hide();
      options.onAction();
    });

    dismissBtn.addEventListener('click', () => {
      clearAutoDismiss();
      hide();
      options.onDismiss();
    });

    shadow.appendChild(container);

    // Trigger slide-up animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (container) {
          container.classList.add('visible');
        }
      });
    });

    // Auto-dismiss after timeout
    clearAutoDismiss();
    autoDismissTimer = setTimeout(() => {
      hide();
      options.onDismiss();
    }, AUTO_DISMISS_MS);
  }

  function hide(): void {
    clearAutoDismiss();

    if (container) {
      container.classList.remove('visible');
      // Remove after transition
      const el = container;
      const onEnd = () => {
        el.remove();
      };

      // Check for reduced motion — if so, remove immediately
      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        el.remove();
      } else {
        el.addEventListener('transitionend', onEnd, { once: true });
        // Fallback removal in case transitionend doesn't fire
        setTimeout(onEnd, 400);
      }

      container = null;
    }
  }

  function destroy(): void {
    clearAutoDismiss();

    if (container) {
      container.remove();
      container = null;
    }

    if (host) {
      host.remove();
      host = null;
    }

    shadowRoot = null;
  }

  return { show, hide, destroy };
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
