// ─── Shared CSS custom properties and base reset ────────────────────

const baseReset = `
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    --support-primary-color: #2563eb;
    --support-primary-hover: #1d4ed8;
    --support-bg: #ffffff;
    --support-bg-secondary: #f8fafc;
    --support-text: #1e293b;
    --support-text-secondary: #64748b;
    --support-border: #e2e8f0;
    --support-error: #dc2626;
    --support-success: #16a34a;
    --support-radius: 8px;
    --support-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif;

    font-family: var(--support-font);
    font-size: 14px;
    line-height: 1.5;
    color: var(--support-text);
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// ─── Modal styles ──────────────────────────────────────────────────

export const modalStyles = `
  ${baseReset}

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: backdrop-fade-in 0.15s ease-out;
  }

  @keyframes backdrop-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes modal-scale-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .modal-content {
    background: var(--support-bg);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
    width: 100%;
    max-width: 520px;
    max-height: calc(100vh - 32px);
    display: flex;
    flex-direction: column;
    animation: modal-scale-in 0.15s ease-out;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--support-border);
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--support-text);
  }

  .modal-close {
    appearance: none;
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: var(--support-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
  }

  .modal-close:hover {
    background: var(--support-bg-secondary);
    color: var(--support-text);
  }

  .modal-close:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .screenshot-preview {
    margin-bottom: 16px;
    border-radius: var(--support-radius);
    overflow: hidden;
    border: 1px solid var(--support-border);
    cursor: pointer;
    max-height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--support-bg-secondary);
  }

  .screenshot-preview img {
    max-width: 100%;
    max-height: 150px;
    object-fit: contain;
    display: block;
  }

  .screenshot-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    cursor: zoom-out;
  }

  .screenshot-overlay img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--support-text-secondary);
    margin-bottom: 6px;
  }

  .description-textarea {
    width: 100%;
    min-height: 72px;
    padding: 10px 12px;
    border: 1px solid var(--support-border);
    border-radius: var(--support-radius);
    font-family: var(--support-font);
    font-size: 14px;
    color: var(--support-text);
    background: var(--support-bg);
    resize: vertical;
    transition: border-color 0.1s;
    margin-bottom: 20px;
  }

  .description-textarea::placeholder {
    color: var(--support-text-secondary);
  }

  .description-textarea:focus {
    outline: none;
    border-color: var(--support-primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .section-heading {
    font-size: 13px;
    font-weight: 600;
    color: var(--support-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
  }

  .category-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .category-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    transition: background 0.1s;
  }

  .category-row:hover {
    background: var(--support-bg-secondary);
  }

  .category-checkbox {
    appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid var(--support-border);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    transition: border-color 0.1s, background 0.1s;
  }

  .category-checkbox:checked {
    background: var(--support-primary-color);
    border-color: var(--support-primary-color);
  }

  .category-checkbox:checked::after {
    content: '';
    position: absolute;
    left: 3px;
    top: 0px;
    width: 6px;
    height: 9px;
    border: solid #fff;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .category-checkbox:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  .category-label {
    flex: 1;
    font-size: 14px;
    color: var(--support-text);
    cursor: pointer;
    user-select: none;
  }

  .category-count {
    font-size: 12px;
    color: var(--support-text-secondary);
  }

  .category-view-btn {
    appearance: none;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--support-primary-color);
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.1s;
  }

  .category-view-btn:hover {
    background: rgba(37, 99, 235, 0.08);
  }

  .category-view-btn:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  .category-detail {
    padding: 8px 12px;
    margin: 4px 0 4px 34px;
    background: var(--support-bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--support-border);
    max-height: 200px;
    overflow-y: auto;
    font-size: 12px;
    font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
      Menlo, Consolas, monospace;
    line-height: 1.6;
    color: var(--support-text);
    white-space: pre-wrap;
    word-break: break-word;
    display: none;
  }

  .category-detail.expanded {
    display: block;
  }

  .category-detail .log-entry {
    padding: 2px 0;
    border-bottom: 1px solid var(--support-border);
  }

  .category-detail .log-entry:last-child {
    border-bottom: none;
  }

  .category-detail .log-level {
    display: inline-block;
    min-width: 42px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
  }

  .category-detail .log-level.error { color: var(--support-error); }
  .category-detail .log-level.warn { color: #d97706; }
  .category-detail .log-level.info { color: var(--support-primary-color); }
  .category-detail .log-level.log { color: var(--support-text-secondary); }
  .category-detail .log-level.debug { color: #7c3aed; }

  .category-detail .net-status {
    display: inline-block;
    min-width: 32px;
    font-weight: 600;
    font-size: 11px;
  }

  .category-detail .net-status.ok { color: var(--support-success); }
  .category-detail .net-status.err { color: var(--support-error); }

  .category-detail .kv-row {
    display: flex;
    gap: 8px;
    padding: 2px 0;
  }

  .category-detail .kv-key {
    font-weight: 600;
    color: var(--support-text-secondary);
    flex-shrink: 0;
  }

  .category-detail .kv-value {
    color: var(--support-text);
    word-break: break-all;
  }

  .category-detail .breadcrumb-entry {
    padding: 2px 0;
    border-bottom: 1px solid var(--support-border);
  }

  .category-detail .breadcrumb-entry:last-child {
    border-bottom: none;
  }

  .category-detail .breadcrumb-type {
    display: inline-block;
    min-width: 72px;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--support-primary-color);
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--support-border);
    flex-shrink: 0;
  }

  .btn {
    appearance: none;
    border: none;
    cursor: pointer;
    font-family: var(--support-font);
    font-size: 14px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: var(--support-radius);
    transition: background 0.1s, opacity 0.1s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .btn:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  .btn-secondary {
    background: var(--support-bg-secondary);
    color: var(--support-text);
    border: 1px solid var(--support-border);
  }

  .btn-secondary:hover {
    background: var(--support-border);
  }

  .btn-primary {
    background: var(--support-primary-color);
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--support-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .status-message {
    font-size: 13px;
    padding: 8px 12px;
    border-radius: 6px;
    margin-top: 12px;
  }

  .status-message.error {
    background: #fef2f2;
    color: var(--support-error);
    border: 1px solid #fecaca;
  }

  .status-message.success {
    background: #f0fdf4;
    color: var(--support-success);
    border: 1px solid #bbf7d0;
  }

  @media (max-width: 480px) {
    .modal-content {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .modal-backdrop {
      padding: 0;
    }

    .modal-body {
      padding: 16px;
    }

    .modal-header,
    .modal-footer {
      padding: 12px 16px;
    }
  }
`;

// ─── Trigger button styles ─────────────────────────────────────────

export const triggerStyles = `
  ${baseReset}

  .trigger-btn {
    position: fixed;
    z-index: 2147483646;
    appearance: none;
    border: none;
    cursor: pointer;
    background: var(--support-primary-color);
    color: #ffffff;
    font-family: var(--support-font);
    font-size: 13px;
    font-weight: 500;
    padding: 10px 16px;
    border-radius: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    animation: trigger-enter 0.3s ease-out;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .trigger-btn:hover {
    background: var(--support-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
  }

  .trigger-btn:active {
    transform: translateY(0);
  }

  .trigger-btn:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  .trigger-btn.hidden {
    display: none;
  }

  .trigger-btn.bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .trigger-btn.bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .trigger-btn.top-right {
    top: 20px;
    right: 20px;
  }

  .trigger-btn.top-left {
    top: 20px;
    left: 20px;
  }

  @keyframes trigger-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .trigger-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    .trigger-btn {
      font-size: 0;
      padding: 12px;
      border-radius: 50%;
    }

    .trigger-btn .trigger-label {
      display: none;
    }
  }
`;

// ─── Toast styles ──────────────────────────────────────────────────

export const toastStyles = `
  ${baseReset}

  .toast-container {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
  }

  .toast {
    background: var(--support-bg);
    color: var(--support-text);
    padding: 12px 16px;
    border-radius: var(--support-radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
    font-family: var(--support-font);
    font-size: 13px;
    max-width: 320px;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: toast-enter 0.25s ease-out;
    pointer-events: auto;
    border-left: 3px solid var(--support-error);
  }

  .toast-message {
    flex: 1;
    word-break: break-word;
  }

  .toast-action {
    appearance: none;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--support-primary-color);
    font-family: var(--support-font);
    font-size: 12px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    transition: background 0.1s;
    flex-shrink: 0;
  }

  .toast-action:hover {
    background: rgba(37, 99, 235, 0.08);
  }

  .toast-action:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  @keyframes toast-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 480px) {
    .toast-container {
      left: 16px;
      right: 16px;
      bottom: 72px;
    }

    .toast {
      max-width: 100%;
    }
  }
`;

// ─── Chat view styles ───────────────────────────────────────────────

export const chatStyles = `
  ${baseReset}

  .chat-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 200px;
    max-height: 400px;
  }

  .chat-message {
    display: flex;
    gap: 8px;
    max-width: 85%;
    animation: message-fade-in 0.15s ease-out;
  }

  @keyframes message-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .chat-message.assistant {
    align-self: flex-start;
  }

  .chat-message.user {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .chat-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
    background: var(--support-bg-secondary);
    border: 1px solid var(--support-border);
  }

  .chat-bubble {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .assistant .chat-bubble {
    background: #f3f4f6;
    color: var(--support-text);
    border-bottom-left-radius: 4px;
    white-space: normal;
  }

  /* ── Markdown styles in assistant bubbles ── */

  .assistant .chat-bubble p {
    margin: 0 0 8px 0;
  }

  .assistant .chat-bubble p:last-child {
    margin-bottom: 0;
  }

  .assistant .chat-bubble strong {
    font-weight: 600;
  }

  .assistant .chat-bubble em {
    font-style: italic;
  }

  .assistant .chat-bubble h1,
  .assistant .chat-bubble h2,
  .assistant .chat-bubble h3,
  .assistant .chat-bubble h4,
  .assistant .chat-bubble h5,
  .assistant .chat-bubble h6 {
    margin: 12px 0 4px 0;
    font-weight: 600;
    line-height: 1.3;
  }

  .assistant .chat-bubble h1 { font-size: 18px; }
  .assistant .chat-bubble h2 { font-size: 16px; }
  .assistant .chat-bubble h3 { font-size: 15px; }
  .assistant .chat-bubble h4,
  .assistant .chat-bubble h5,
  .assistant .chat-bubble h6 { font-size: 14px; }

  .assistant .chat-bubble h1:first-child,
  .assistant .chat-bubble h2:first-child,
  .assistant .chat-bubble h3:first-child,
  .assistant .chat-bubble h4:first-child,
  .assistant .chat-bubble h5:first-child,
  .assistant .chat-bubble h6:first-child {
    margin-top: 0;
  }

  .assistant .chat-bubble ul,
  .assistant .chat-bubble ol {
    margin: 4px 0 8px 0;
    padding-left: 20px;
  }

  .assistant .chat-bubble ul:last-child,
  .assistant .chat-bubble ol:last-child {
    margin-bottom: 0;
  }

  .assistant .chat-bubble li {
    margin-bottom: 2px;
  }

  .assistant .chat-bubble code {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono',
      Menlo, Consolas, monospace;
    font-size: 13px;
  }

  .assistant .chat-bubble pre {
    background: rgba(0, 0, 0, 0.06);
    padding: 8px 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 4px 0 8px 0;
  }

  .assistant .chat-bubble pre:last-child {
    margin-bottom: 0;
  }

  .assistant .chat-bubble pre code {
    background: none;
    padding: 0;
    border-radius: 0;
  }

  .assistant .chat-bubble a {
    color: var(--support-primary-color);
    text-decoration: underline;
  }

  .assistant .chat-bubble a:hover {
    text-decoration: none;
  }

  .user .chat-bubble {
    background: #2563eb;
    color: #ffffff;
    border-bottom-right-radius: 4px;
  }

  .streaming-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--support-text);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: cursor-blink 0.8s step-end infinite;
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .thinking-indicator {
    display: flex;
    gap: 8px;
    align-self: flex-start;
    padding: 0 0 0 36px;
  }

  .thinking-dots {
    display: flex;
    gap: 4px;
    padding: 10px 14px;
    background: #f3f4f6;
    border-radius: 12px;
    border-bottom-left-radius: 4px;
  }

  .thinking-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--support-text-secondary);
    animation: thinking-bounce 1.2s ease-in-out infinite;
  }

  .thinking-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .thinking-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes thinking-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  .chat-input-area {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--support-border);
  }

  .chat-input {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: 10px 12px;
    border: 1px solid var(--support-border);
    border-radius: var(--support-radius);
    font-family: var(--support-font);
    font-size: 14px;
    color: var(--support-text);
    background: var(--support-bg);
    resize: none;
    transition: border-color 0.1s;
    line-height: 1.4;
  }

  .chat-input::placeholder {
    color: var(--support-text-secondary);
  }

  .chat-input:focus {
    outline: none;
    border-color: var(--support-primary-color);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .chat-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-send-btn {
    appearance: none;
    background: var(--support-primary-color);
    color: #ffffff;
    border: none;
    cursor: pointer;
    width: 40px;
    height: 40px;
    border-radius: var(--support-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.1s, opacity 0.1s;
  }

  .chat-send-btn:hover:not(:disabled) {
    background: var(--support-primary-hover);
  }

  .chat-send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .chat-send-btn:focus-visible {
    outline: 2px solid var(--support-primary-color);
    outline-offset: 2px;
  }

  .chat-send-icon {
    width: 18px;
    height: 18px;
  }

  /* ── Summary mode ── */

  .summary-container {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
  }

  .summary-card {
    background: var(--support-bg);
    border: 1px solid var(--support-border);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .summary-category-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
    width: fit-content;
  }

  .summary-category-badge.bug {
    background: #fef2f2;
    color: #dc2626;
  }

  .summary-category-badge.feedback {
    background: #eff6ff;
    color: #2563eb;
  }

  .summary-category-badge.feature_request {
    background: #f0fdf4;
    color: #16a34a;
  }

  .summary-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--support-text);
  }

  .summary-description {
    font-size: 14px;
    color: var(--support-text);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .summary-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-section-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--support-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .summary-section-value {
    font-size: 14px;
    color: var(--support-text);
    line-height: 1.5;
  }

  .summary-steps {
    list-style: decimal;
    padding-left: 20px;
    font-size: 14px;
    color: var(--support-text);
    line-height: 1.6;
  }

  .summary-meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .summary-meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--support-text-secondary);
  }

  .summary-meta-value {
    font-weight: 500;
    color: var(--support-text);
  }

  .summary-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .summary-tag {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--support-bg-secondary);
    color: var(--support-text-secondary);
    border: 1px solid var(--support-border);
  }

  .summary-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-top: 1px solid var(--support-border);
    flex-shrink: 0;
  }

  .chat-error {
    padding: 12px 20px;
    background: #fef2f2;
    color: var(--support-error);
    font-size: 13px;
    text-align: center;
  }

  @media (max-width: 480px) {
    .chat-messages {
      padding: 12px 16px;
      max-height: 300px;
    }

    .chat-input-area {
      padding: 10px 16px 12px;
    }

    .summary-container {
      padding: 16px;
    }

    .summary-actions {
      padding: 12px 16px;
    }
  }
`;
