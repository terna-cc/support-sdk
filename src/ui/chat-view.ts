import { chatStyles } from './styles';
import type { ChatMessage, ReportSummary } from '../types';
import type { ChatManager } from '../chat/chat-manager';

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
  addAssistantChunk(text: string): void;
  showThinking(): void;
  hideThinking(): void;
  finalizeAssistantMessage(): void;
  addUserMessage(content: string): void;
  setInputEnabled(enabled: boolean): void;
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

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug Report',
  feedback: 'Feedback',
  feature_request: 'Feature Request',
};

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

// ─── Main factory ──────────────────────────────────────────────────

export function createChatView(
  chatManager: ChatManager,
  callbacks: ChatViewCallbacks,
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

  // ── Current streaming bubble ──
  let currentStreamingBubble: HTMLElement | null = null;
  let currentStreamingCursor: HTMLElement | null = null;

  // ── Error area ──
  let errorEl: HTMLElement | null = null;

  // ── Input area ──
  const inputArea = el('div', 'chat-input-area');

  const chatInput = el('textarea', 'chat-input');
  chatInput.placeholder = 'Type your message...';
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

    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    clearError();
    addUserMessage(content);
    chatManager.sendMessage(content);
  }

  function scrollToBottom(): void {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addUserMessage(content: string): void {
    const msg = el('div', 'chat-message user');
    const bubble = el('div', 'chat-bubble');
    bubble.textContent = content;
    msg.appendChild(bubble);
    messagesContainer.appendChild(msg);
    scrollToBottom();
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

    if (!currentStreamingBubble) {
      const msg = createAssistantMessage();
      messagesContainer.appendChild(msg);
      currentStreamingBubble = msg.querySelector('.chat-bubble')!;

      // Add blinking cursor
      currentStreamingCursor = el('span', 'streaming-cursor');
      currentStreamingBubble.appendChild(currentStreamingCursor);
    }

    // Insert text before the cursor
    if (currentStreamingCursor && currentStreamingCursor.parentNode) {
      const textNode = document.createTextNode(text);
      currentStreamingBubble.insertBefore(textNode, currentStreamingCursor);
    }

    scrollToBottom();
  }

  function finalizeAssistantMessage(): void {
    if (currentStreamingCursor) {
      currentStreamingCursor.remove();
      currentStreamingCursor = null;
    }
    currentStreamingBubble = null;
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

  function showError(message: string): void {
    clearError();
    errorEl = el('div', 'chat-error');
    errorEl.textContent = message;
    // Insert before input area
    container.insertBefore(errorEl, inputArea);
  }

  function clearError(): void {
    if (errorEl) {
      errorEl.remove();
      errorEl = null;
    }
  }

  function setInputEnabled(enabled: boolean): void {
    chatInput.disabled = !enabled;
    sendBtn.disabled = !enabled || chatInput.value.trim() === '';
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
    scrollToBottom();
  }

  function showSummary(summary: ReportSummary): void {
    currentSummary = summary;
    hideThinking();
    finalizeAssistantMessage();

    // Hide chat view
    messagesContainer.style.display = 'none';
    inputArea.style.display = 'none';
    clearError();

    // Build summary container
    summaryContainer = el('div', 'summary-container');

    const card = el('div', 'summary-card');

    // Category badge
    const badge = el('div', `summary-category-badge ${summary.category}`);
    const icon = CATEGORY_ICONS[summary.category] ?? '';
    const label = CATEGORY_LABELS[summary.category] ?? summary.category;
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
      sectionLabel.textContent = 'Steps to Reproduce';
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
      sectionLabel.textContent = 'Expected Behavior';
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
      sectionLabel.textContent = 'Actual Behavior';
      section.appendChild(sectionLabel);
      const value = el('div', 'summary-section-value');
      value.textContent = summary.actual_behavior;
      section.appendChild(value);
      card.appendChild(section);
    }

    // Meta: severity + tags
    const meta = el('div', 'summary-meta');

    const severityItem = el('span', 'summary-meta-item');
    severityItem.innerHTML = 'Severity: ';
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
    keepChattingBtn.textContent = '\u2190 Keep chatting';

    const submitBtn = el('button', 'btn btn-primary');
    submitBtn.type = 'button';
    submitBtn.textContent = 'Submit \u2713';

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
      submitBtn.appendChild(document.createTextNode(' Submitting...'));

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
          err instanceof Error ? err.message : 'Failed to submit report',
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

  function destroy(): void {
    container.remove();
    currentStreamingBubble = null;
    currentStreamingCursor = null;
    thinkingEl = null;
    errorEl = null;
    summaryContainer = null;
    summaryActionsEl = null;
    currentSummary = null;
  }

  return {
    getContainer,
    showChat,
    showSummary,
    showError,
    addAssistantChunk,
    showThinking,
    hideThinking,
    finalizeAssistantMessage,
    addUserMessage,
    setInputEnabled,
    destroy,
  };
}
