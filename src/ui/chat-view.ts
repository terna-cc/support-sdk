import { chatStyles } from './styles';
import type { ChatMessage, ReportSummary } from '../types';
import type { ChatManager } from '../chat/chat-manager';
import type { AttachmentManager, Attachment } from '../chat/attachment-manager';
import { formatFileSize } from '../chat/attachment-manager';
import { renderMarkdown } from '../core/markdown';
import type { Translations } from '../i18n/translations';

// ─── Public interfaces ─────────────────────────────────────────────

export interface ChatViewCallbacks {
  onSubmit: (data: {
    description: string;
    conversation: ChatMessage[];
    aiSummary: ReportSummary;
  }) => Promise<void>;
  onCancel: () => void;
  onKeepChatting: () => void;
}

export interface ChatView {
  getContainer(): HTMLElement;
  showChat(): void;
  showSummary(summary: ReportSummary): void;
  showError(message: string): void;
  showChatError(message: string, onRetry?: () => void): void;
  addAssistantChunk(text: string): void;
  showThinking(): void;
  hideThinking(): void;
  showTypingIndicator(): void;
  hideTypingIndicator(): void;
  finalizeAssistantMessage(): void;
  addUserMessage(content: string): void;
  setInputEnabled(enabled: boolean): void;
  getAttachmentManager(): AttachmentManager | null;
  destroy(): void;
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

const CATEGORY_ICONS: Record<string, string> = {
  bug: '\u{1F41B}',
  feedback: '\u{1F4AC}',
  feature_request: '\u{2728}',
};

function getCategoryLabels(t: Translations): Record<string, string> {
  return {
    bug: t.categoryBug,
    feedback: t.categoryFeedback,
    feature_request: t.categoryFeature,
  };
}

function truncateFilename(name: string, maxLen: number = 25): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf('.');
  if (ext === -1) return name.slice(0, maxLen - 3) + '...';
  const extension = name.slice(ext);
  const base = name.slice(0, maxLen - extension.length - 3);
  return base + '...' + extension;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '\u{1F5BC}\uFE0F'; // 🖼️
  if (mimeType === 'application/pdf') return '\u{1F4C4}'; // 📄
  if (mimeType.startsWith('text/')) return '\u{1F4CB}'; // 📋
  if (mimeType === 'application/json') return '\u{1F4CB}'; // 📋
  return '\u{1F4C4}'; // 📄
}

// ─── Send icon SVG ──────────────────────────────────────────────────

function createSendIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chat-send-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '22');
  line.setAttribute('y1', '2');
  line.setAttribute('x2', '11');
  line.setAttribute('y2', '13');
  const polygon = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'polygon',
  );
  polygon.setAttribute('points', '22 2 15 22 11 13 2 9 22 2');
  svg.appendChild(line);
  svg.appendChild(polygon);
  return svg;
}

// ─── Attachment icon SVG (paperclip) ────────────────────────────────

function createAttachmentIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chat-attachment-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48',
  );
  svg.appendChild(path);
  return svg;
}

// ─── Main factory ──────────────────────────────────────────────────

export function createChatView(
  chatManager: ChatManager,
  callbacks: ChatViewCallbacks,
  translations: Translations,
  attachmentManager?: AttachmentManager,
): ChatView {
  // Root container
  const container = el('div', 'chat-container');

  // Style
  const style = document.createElement('style');
  style.textContent = chatStyles;
  container.appendChild(style);

  // ── Messages area ──
  const messagesContainer = el('div', 'chat-messages');
  messagesContainer.setAttribute('role', 'log');
  messagesContainer.setAttribute('aria-label', 'Chat messages');
  container.appendChild(messagesContainer);

  // ── Thinking indicator ──
  let thinkingEl: HTMLElement | null = null;

  // ── Typing indicator (assistant bubble with animated dots) ──
  let typingEl: HTMLElement | null = null;

  // ── Current streaming bubble ──
  let currentStreamingBubble: HTMLElement | null = null;
  let currentStreamingCursor: HTMLElement | null = null;
  let currentStreamingContent = '';

  // ── Error area ──
  let errorEl: HTMLElement | null = null;

  // ── Chat error bubble (in messages area) ──
  let chatErrorBubbleEl: HTMLElement | null = null;

  // ── Attachment preview bar (above input area) ──
  let attachmentPreviewBar: HTMLElement | null = null;

  // ── File input (hidden) ──
  let fileInput: HTMLInputElement | null = null;

  // ── Build allowed types accept attribute ──
  const acceptTypes = attachmentManager
    ? (() => {
        // We pull the allowed types from the manager's configuration indirectly
        // by just using a broad accept string. Validation is done by the manager.
        return 'image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,application/json,text/xml';
      })()
    : '';

  if (attachmentManager) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = acceptTypes;
    fileInput.style.display = 'none';
    fileInput.setAttribute('aria-hidden', 'true');
    container.appendChild(fileInput);

    fileInput.addEventListener('change', () => {
      if (fileInput?.files && fileInput.files.length > 0) {
        handleFilesAdded(fileInput.files);
        fileInput.value = '';
      }
    });
  }

  // ── Input area ──
  const inputArea = el('div', 'chat-input-area');

  // ── Attachment button ──
  let attachBtn: HTMLButtonElement | null = null;
  if (attachmentManager) {
    attachBtn = el('button', 'chat-attach-btn');
    attachBtn.type = 'button';
    attachBtn.setAttribute('aria-label', 'Attach files');
    attachBtn.appendChild(createAttachmentIcon());
    inputArea.appendChild(attachBtn);

    attachBtn.addEventListener('click', () => {
      fileInput?.click();
    });
  }

  const chatInput = el('textarea', 'chat-input');
  chatInput.placeholder = translations.inputPlaceholder;
  chatInput.rows = 1;
  chatInput.setAttribute('aria-label', 'Chat message input');

  const sendBtn = el('button', 'chat-send-btn');
  sendBtn.type = 'button';
  sendBtn.setAttribute('aria-label', 'Send message');
  sendBtn.appendChild(createSendIcon());
  sendBtn.disabled = true;

  inputArea.appendChild(chatInput);
  inputArea.appendChild(sendBtn);
  container.appendChild(inputArea);

  // ── Drag and drop ──
  if (attachmentManager) {
    let dragCounter = 0;

    container.addEventListener('dragenter', (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        container.classList.remove('drag-over');
      }
    });

    container.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
    });

    container.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      container.classList.remove('drag-over');

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(e.dataTransfer.files);
      }
    });
  }

  // ── Summary view (hidden initially) ──
  let summaryContainer: HTMLElement | null = null;
  let summaryActionsEl: HTMLElement | null = null;
  let currentSummary: ReportSummary | null = null;

  // ── Auto-resize textarea ──
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    sendBtn.disabled = chatInput.value.trim() === '' || chatInput.disabled;
  });

  // ── Send on Enter (Shift+Enter for newline) ──
  chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  sendBtn.addEventListener('click', () => handleSend());

  function handleSend(): void {
    const content = chatInput.value.trim();
    if (!content || chatInput.disabled) return;

    // Capture current attachments for display in the message
    const currentAttachments = attachmentManager?.getAll() ?? [];

    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    clearError();
    clearChatError();
    addUserMessage(content, currentAttachments);
    showTypingIndicator();
    chatManager.sendMessage(content);

    // Clear attachments after sending (but don't destroy — they stay for submission)
    // Attachments are kept in the manager for final report submission
  }

  function scrollToBottom(): void {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addUserMessage(
    content: string,
    messageAttachments?: Attachment[],
  ): void {
    const msg = el('div', 'chat-message user');
    const bubble = el('div', 'chat-bubble');
    bubble.textContent = content;

    // Render attachment chips in the message bubble
    if (messageAttachments && messageAttachments.length > 0) {
      const chipsContainer = el('div', 'attachment-chips');
      for (const attachment of messageAttachments) {
        const chip = el('div', 'attachment-chip');
        const icon = document.createTextNode(
          getFileIcon(attachment.type) + ' ',
        );
        chip.appendChild(icon);
        const nameSpan = el('span', 'attachment-chip-name');
        nameSpan.textContent = truncateFilename(attachment.name);
        chip.appendChild(nameSpan);
        const sizeSpan = el('span', 'attachment-chip-size');
        sizeSpan.textContent = ` (${formatFileSize(attachment.size)})`;
        chip.appendChild(sizeSpan);
        chipsContainer.appendChild(chip);
      }
      bubble.appendChild(chipsContainer);
    }

    msg.appendChild(bubble);
    messagesContainer.appendChild(msg);
    scrollToBottom();
  }

  function handleFilesAdded(files: FileList): void {
    if (!attachmentManager) return;

    clearError();
    const result = attachmentManager.add(files);

    // Show errors if any
    if (result.errors.length > 0) {
      const errorMessages = result.errors.map(
        (e) => `${e.file.name}: ${e.reason}`,
      );
      showError(errorMessages.join('; '));
    }

    renderAttachmentPreviewBar();
  }

  function renderAttachmentPreviewBar(): void {
    if (!attachmentManager) return;

    const attachments = attachmentManager.getAll();

    // Remove existing bar
    if (attachmentPreviewBar) {
      attachmentPreviewBar.remove();
      attachmentPreviewBar = null;
    }

    if (attachments.length === 0) return;

    attachmentPreviewBar = el('div', 'attachment-preview-bar');

    for (const attachment of attachments) {
      const item = el('div', 'attachment-preview-item');

      // Thumbnail or icon
      if (attachment.previewUrl) {
        const thumb = el('img', 'attachment-thumbnail');
        thumb.src = attachment.previewUrl;
        thumb.alt = attachment.name;
        item.appendChild(thumb);
      } else {
        const iconEl = el('span', 'attachment-icon');
        iconEl.textContent = getFileIcon(attachment.type);
        item.appendChild(iconEl);
      }

      // Filename
      const nameEl = el('span', 'attachment-name');
      nameEl.textContent = truncateFilename(attachment.name);
      nameEl.title = attachment.name;
      item.appendChild(nameEl);

      // Size
      const sizeEl = el('span', 'attachment-size');
      sizeEl.textContent = `(${formatFileSize(attachment.size)})`;
      item.appendChild(sizeEl);

      // Remove button
      const removeBtn = el('button', 'attachment-remove-btn');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Remove ${attachment.name}`);
      removeBtn.textContent = '\u2715'; // ✕
      removeBtn.addEventListener('click', () => {
        attachmentManager!.remove(attachment.id);
        renderAttachmentPreviewBar();
      });
      item.appendChild(removeBtn);

      attachmentPreviewBar.appendChild(item);
    }

    // Insert before input area
    container.insertBefore(attachmentPreviewBar, inputArea);
  }

  function createAssistantMessage(): HTMLElement {
    const msg = el('div', 'chat-message assistant');
    const avatar = el('div', 'chat-avatar');
    avatar.textContent = '\u{1F916}';
    const bubble = el('div', 'chat-bubble');
    msg.appendChild(avatar);
    msg.appendChild(bubble);
    return msg;
  }

  function addAssistantChunk(text: string): void {
    hideThinking();
    hideTypingIndicator();

    if (!currentStreamingBubble) {
      const msg = createAssistantMessage();
      messagesContainer.appendChild(msg);
      currentStreamingBubble = msg.querySelector('.chat-bubble')!;
      currentStreamingContent = '';

      // Add blinking cursor
      currentStreamingCursor = el('span', 'streaming-cursor');
      currentStreamingBubble.appendChild(currentStreamingCursor);
    }

    currentStreamingContent += text;

    // Insert text before the cursor (plain text during streaming)
    if (currentStreamingCursor && currentStreamingCursor.parentNode) {
      const textNode = document.createTextNode(text);
      currentStreamingBubble.insertBefore(textNode, currentStreamingCursor);
    }

    scrollToBottom();
  }

  function finalizeAssistantMessage(): void {
    // Render accumulated markdown content as HTML
    if (currentStreamingBubble && currentStreamingContent) {
      const html = renderMarkdown(currentStreamingContent);
      // Remove the streaming cursor first
      if (currentStreamingCursor) {
        currentStreamingCursor.remove();
        currentStreamingCursor = null;
      }
      // Replace plain text with rendered markdown
      currentStreamingBubble.innerHTML = html;
    } else if (currentStreamingCursor) {
      currentStreamingCursor.remove();
      currentStreamingCursor = null;
    }
    currentStreamingBubble = null;
    currentStreamingContent = '';
  }

  function showThinking(): void {
    if (thinkingEl) return;

    thinkingEl = el('div', 'thinking-indicator');
    const dots = el('div', 'thinking-dots');
    for (let i = 0; i < 3; i++) {
      dots.appendChild(el('span', 'thinking-dot'));
    }
    thinkingEl.appendChild(dots);
    messagesContainer.appendChild(thinkingEl);
    scrollToBottom();
  }

  function hideThinking(): void {
    if (thinkingEl) {
      thinkingEl.remove();
      thinkingEl = null;
    }
  }

  function showTypingIndicator(): void {
    if (typingEl) return;

    typingEl = el('div', 'typing-indicator');
    const avatar = el('div', 'chat-avatar');
    avatar.textContent = '\u{1F916}';
    const dots = el('div', 'typing-dots');
    for (let i = 0; i < 3; i++) {
      dots.appendChild(el('span', 'typing-dot'));
    }
    typingEl.appendChild(avatar);
    typingEl.appendChild(dots);
    messagesContainer.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTypingIndicator(): void {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function showError(message: string): void {
    clearError();
    errorEl = el('div', 'chat-error');
    errorEl.textContent = message;
    // Insert before attachment bar or input area
    const insertBefore = attachmentPreviewBar ?? inputArea;
    container.insertBefore(errorEl, insertBefore);
  }

  function clearError(): void {
    if (errorEl) {
      errorEl.remove();
      errorEl = null;
    }
  }

  function clearChatError(): void {
    if (chatErrorBubbleEl) {
      chatErrorBubbleEl.remove();
      chatErrorBubbleEl = null;
    }
  }

  function showChatError(message: string, onRetry?: () => void): void {
    clearChatError();

    chatErrorBubbleEl = el('div', 'chat-message assistant');

    const avatar = el('div', 'chat-avatar');
    avatar.textContent = '\u{1F916}';

    const bubble = el('div', 'chat-bubble chat-bubble-error');
    bubble.textContent = message;

    if (onRetry) {
      const retryBtn = el('button', 'chat-retry-btn');
      retryBtn.type = 'button';
      retryBtn.textContent = translations.retryButton;
      retryBtn.addEventListener('click', () => {
        clearChatError();
        onRetry();
      });
      bubble.appendChild(retryBtn);
    }

    chatErrorBubbleEl.appendChild(avatar);
    chatErrorBubbleEl.appendChild(bubble);
    messagesContainer.appendChild(chatErrorBubbleEl);
    scrollToBottom();
  }

  function setInputEnabled(enabled: boolean): void {
    chatInput.disabled = !enabled;
    sendBtn.disabled = !enabled || chatInput.value.trim() === '';
    if (attachBtn) {
      attachBtn.disabled = !enabled;
    }
  }

  function showChat(): void {
    // Hide summary if visible
    if (summaryContainer) {
      summaryContainer.remove();
      summaryContainer = null;
    }
    if (summaryActionsEl) {
      summaryActionsEl.remove();
      summaryActionsEl = null;
    }

    // Show messages and input
    messagesContainer.style.display = 'flex';
    inputArea.style.display = 'flex';
    if (attachmentPreviewBar) {
      attachmentPreviewBar.style.display = 'flex';
    }
    scrollToBottom();
  }

  function showSummary(summary: ReportSummary): void {
    currentSummary = summary;
    hideThinking();
    finalizeAssistantMessage();

    // Hide chat view
    messagesContainer.style.display = 'none';
    inputArea.style.display = 'none';
    if (attachmentPreviewBar) {
      attachmentPreviewBar.style.display = 'none';
    }
    clearError();

    // Build summary container
    summaryContainer = el('div', 'summary-container');

    const card = el('div', 'summary-card');

    // Category badge
    const badge = el('div', `summary-category-badge ${summary.category}`);
    const icon = CATEGORY_ICONS[summary.category] ?? '';
    const categoryLabels = getCategoryLabels(translations);
    const label = categoryLabels[summary.category] ?? summary.category;
    badge.textContent = `${icon} ${label}`;
    card.appendChild(badge);

    // Title
    const title = el('div', 'summary-title');
    title.textContent = summary.title;
    card.appendChild(title);

    // Description
    const description = el('div', 'summary-description');
    description.textContent = summary.description;
    card.appendChild(description);

    // Steps to reproduce
    if (summary.steps_to_reproduce && summary.steps_to_reproduce.length > 0) {
      const section = el('div', 'summary-section');
      const sectionLabel = el('div', 'summary-section-label');
      sectionLabel.textContent = translations.stepsToReproduce;
      section.appendChild(sectionLabel);

      const steps = el('ol', 'summary-steps');
      for (const step of summary.steps_to_reproduce) {
        const li = document.createElement('li');
        li.textContent = step;
        steps.appendChild(li);
      }
      section.appendChild(steps);
      card.appendChild(section);
    }

    // Expected behavior
    if (summary.expected_behavior) {
      const section = el('div', 'summary-section');
      const sectionLabel = el('div', 'summary-section-label');
      sectionLabel.textContent = translations.expectedBehavior;
      section.appendChild(sectionLabel);
      const value = el('div', 'summary-section-value');
      value.textContent = summary.expected_behavior;
      section.appendChild(value);
      card.appendChild(section);
    }

    // Actual behavior
    if (summary.actual_behavior) {
      const section = el('div', 'summary-section');
      const sectionLabel = el('div', 'summary-section-label');
      sectionLabel.textContent = translations.actualBehavior;
      section.appendChild(sectionLabel);
      const value = el('div', 'summary-section-value');
      value.textContent = summary.actual_behavior;
      section.appendChild(value);
      card.appendChild(section);
    }

    // Meta: severity + tags
    const meta = el('div', 'summary-meta');

    const severityItem = el('span', 'summary-meta-item');
    severityItem.innerHTML = `${translations.severity}: `;
    const severityValue = el('span', 'summary-meta-value');
    severityValue.textContent =
      summary.severity.charAt(0).toUpperCase() + summary.severity.slice(1);
    severityItem.appendChild(severityValue);
    meta.appendChild(severityItem);
    card.appendChild(meta);

    // Tags
    if (summary.tags.length > 0) {
      const tagsContainer = el('div', 'summary-tags');
      for (const tag of summary.tags) {
        const tagEl = el('span', 'summary-tag');
        tagEl.textContent = tag;
        tagsContainer.appendChild(tagEl);
      }
      card.appendChild(tagsContainer);
    }

    summaryContainer.appendChild(card);
    container.insertBefore(summaryContainer, inputArea);

    // Summary actions (replaces input area)
    summaryActionsEl = el('div', 'summary-actions');

    const keepChattingBtn = el('button', 'btn btn-secondary');
    keepChattingBtn.type = 'button';
    keepChattingBtn.textContent = `\u2190 ${translations.keepChatting}`;

    const submitBtn = el('button', 'btn btn-primary');
    submitBtn.type = 'button';
    submitBtn.textContent = `${translations.submitButton} \u2713`;

    keepChattingBtn.addEventListener('click', () => {
      callbacks.onKeepChatting();
    });

    submitBtn.addEventListener('click', async () => {
      if (!currentSummary) return;

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = '';
      const spinner = el('span', 'spinner');
      submitBtn.appendChild(spinner);
      submitBtn.appendChild(
        document.createTextNode(` ${translations.submitting}`),
      );

      try {
        await callbacks.onSubmit({
          description: `${currentSummary.title}\n\n${currentSummary.description}`,
          conversation: chatManager.getMessages(),
          aiSummary: currentSummary,
        });
      } catch (err) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        showError(
          err instanceof Error ? err.message : translations.submitFailed,
        );
      }
    });

    summaryActionsEl.appendChild(keepChattingBtn);
    summaryActionsEl.appendChild(submitBtn);
    container.appendChild(summaryActionsEl);
  }

  function getContainer(): HTMLElement {
    return container;
  }

  function getAttachmentManagerRef(): AttachmentManager | null {
    return attachmentManager ?? null;
  }

  function destroy(): void {
    attachmentManager?.destroy();
    if (attachmentPreviewBar) {
      attachmentPreviewBar.remove();
      attachmentPreviewBar = null;
    }
    hideThinking();
    hideTypingIndicator();
    container.remove();
    currentStreamingBubble = null;
    currentStreamingCursor = null;
    currentStreamingContent = '';
    errorEl = null;
    chatErrorBubbleEl = null;
    summaryContainer = null;
    summaryActionsEl = null;
    currentSummary = null;
  }

  return {
    getContainer,
    showChat,
    showSummary,
    showError,
    showChatError,
    addAssistantChunk,
    showThinking,
    hideThinking,
    showTypingIndicator,
    hideTypingIndicator,
    finalizeAssistantMessage,
    addUserMessage,
    setInputEnabled,
    getAttachmentManager: getAttachmentManagerRef,
    destroy,
  };
}
