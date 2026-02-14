import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatView, type ChatView } from '../chat-view';
import type { ChatManager } from '../../chat/chat-manager';
import type { ReportSummary } from '../../types';
import { getTranslations } from '../../i18n/translations';

function makeMockChatManager(
  overrides: Partial<ChatManager> = {},
): ChatManager {
  return {
    start: vi.fn(),
    sendMessage: vi.fn(),
    onTextChunk: vi.fn(),
    onSummary: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    getMessages: vi.fn(() => []),
    isStreaming: vi.fn(() => false),
    abort: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

const mockSummary: ReportSummary = {
  category: 'bug',
  title: 'Cannot add candidates',
  description:
    'Clicking "Add Candidate" on the project page returns a 500 error.',
  steps_to_reproduce: ['Go to project page', 'Click Add Candidate'],
  expected_behavior: 'Candidate is created',
  actual_behavior: 'Error 500 is returned',
  severity: 'high',
  tags: ['candidates', 'form'],
};

describe('createChatView', () => {
  let chatView: ChatView;
  let mockManager: ChatManager;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;
  let onKeepChatting: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockManager = makeMockChatManager();
    onSubmit = vi.fn().mockResolvedValue(undefined);
    onCancel = vi.fn();
    onKeepChatting = vi.fn();

    chatView = createChatView(
      mockManager,
      {
        onSubmit,
        onCancel,
        onKeepChatting,
      },
      getTranslations('en'),
    );
  });

  afterEach(() => {
    chatView.destroy();
  });

  describe('getContainer()', () => {
    it('returns a container element', () => {
      const container = chatView.getContainer();
      expect(container).toBeInstanceOf(HTMLElement);
      expect(container.className).toBe('chat-container');
    });

    it('contains messages area and input area', () => {
      const container = chatView.getContainer();
      const messages = container.querySelector('.chat-messages');
      const input = container.querySelector('.chat-input-area');

      expect(messages).not.toBeNull();
      expect(input).not.toBeNull();
    });

    it('contains a textarea and send button', () => {
      const container = chatView.getContainer();
      const textarea = container.querySelector('.chat-input');
      const sendBtn = container.querySelector('.chat-send-btn');

      expect(textarea).not.toBeNull();
      expect(sendBtn).not.toBeNull();
    });
  });

  describe('addUserMessage()', () => {
    it('adds a user message bubble', () => {
      chatView.addUserMessage('Hello');

      const container = chatView.getContainer();
      const userMessages = container.querySelectorAll('.chat-message.user');
      expect(userMessages).toHaveLength(1);

      const bubble = userMessages[0].querySelector('.chat-bubble');
      expect(bubble?.textContent).toBe('Hello');
    });
  });

  describe('addAssistantChunk()', () => {
    it('creates an assistant message and adds text', () => {
      chatView.addAssistantChunk('Hello ');
      chatView.addAssistantChunk('world');

      const container = chatView.getContainer();
      const assistantMessages = container.querySelectorAll(
        '.chat-message.assistant',
      );
      expect(assistantMessages).toHaveLength(1);

      const bubble = assistantMessages[0].querySelector('.chat-bubble');
      // Text + streaming cursor
      expect(bubble?.textContent).toContain('Hello ');
      expect(bubble?.textContent).toContain('world');
    });

    it('shows streaming cursor while streaming', () => {
      chatView.addAssistantChunk('Streaming...');

      const container = chatView.getContainer();
      const cursor = container.querySelector('.streaming-cursor');
      expect(cursor).not.toBeNull();
    });

    it('hides thinking indicator when chunk arrives', () => {
      chatView.showThinking();
      const container = chatView.getContainer();
      expect(container.querySelector('.thinking-indicator')).not.toBeNull();

      chatView.addAssistantChunk('Hello');
      expect(container.querySelector('.thinking-indicator')).toBeNull();
    });
  });

  describe('finalizeAssistantMessage()', () => {
    it('removes the streaming cursor', () => {
      chatView.addAssistantChunk('Done');
      chatView.finalizeAssistantMessage();

      const container = chatView.getContainer();
      const cursor = container.querySelector('.streaming-cursor');
      expect(cursor).toBeNull();
    });
  });

  describe('showThinking()', () => {
    it('shows thinking dots', () => {
      chatView.showThinking();

      const container = chatView.getContainer();
      const thinking = container.querySelector('.thinking-indicator');
      expect(thinking).not.toBeNull();

      const dots = container.querySelectorAll('.thinking-dot');
      expect(dots).toHaveLength(3);
    });

    it('does not duplicate thinking indicator', () => {
      chatView.showThinking();
      chatView.showThinking();

      const container = chatView.getContainer();
      const indicators = container.querySelectorAll('.thinking-indicator');
      expect(indicators).toHaveLength(1);
    });
  });

  describe('hideThinking()', () => {
    it('removes thinking indicator', () => {
      chatView.showThinking();
      chatView.hideThinking();

      const container = chatView.getContainer();
      expect(container.querySelector('.thinking-indicator')).toBeNull();
    });
  });

  describe('showError()', () => {
    it('shows error message', () => {
      chatView.showError('Connection failed');

      const container = chatView.getContainer();
      const error = container.querySelector('.chat-error');
      expect(error).not.toBeNull();
      expect(error?.textContent).toBe('Connection failed');
    });

    it('replaces previous error', () => {
      chatView.showError('Error 1');
      chatView.showError('Error 2');

      const container = chatView.getContainer();
      const errors = container.querySelectorAll('.chat-error');
      expect(errors).toHaveLength(1);
      expect(errors[0].textContent).toBe('Error 2');
    });
  });

  describe('setInputEnabled()', () => {
    it('disables input and send button', () => {
      chatView.setInputEnabled(false);

      const container = chatView.getContainer();
      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;
      const sendBtn = container.querySelector(
        '.chat-send-btn',
      ) as HTMLButtonElement;

      expect(input.disabled).toBe(true);
      expect(sendBtn.disabled).toBe(true);
    });

    it('enables input', () => {
      chatView.setInputEnabled(false);
      chatView.setInputEnabled(true);

      const container = chatView.getContainer();
      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;

      expect(input.disabled).toBe(false);
    });
  });

  describe('showSummary()', () => {
    it('shows summary card with category badge', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      const badge = container.querySelector('.summary-category-badge');
      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('Bug Report');
    });

    it('shows title and description', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      const title = container.querySelector('.summary-title');
      const description = container.querySelector('.summary-description');

      expect(title?.textContent).toBe('Cannot add candidates');
      expect(description?.textContent).toContain('Clicking "Add Candidate"');
    });

    it('shows steps to reproduce', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      const steps = container.querySelectorAll('.summary-steps li');
      expect(steps).toHaveLength(2);
      expect(steps[0].textContent).toBe('Go to project page');
      expect(steps[1].textContent).toBe('Click Add Candidate');
    });

    it('shows severity and tags', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      const severity = container.querySelector('.summary-meta-value');
      expect(severity?.textContent).toBe('High');

      const tags = container.querySelectorAll('.summary-tag');
      expect(tags).toHaveLength(2);
      expect(tags[0].textContent).toBe('candidates');
      expect(tags[1].textContent).toBe('form');
    });

    it('hides chat messages and input, shows summary', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      const messages = container.querySelector('.chat-messages') as HTMLElement;
      const inputArea = container.querySelector(
        '.chat-input-area',
      ) as HTMLElement;
      const summaryContainer = container.querySelector('.summary-container');
      const summaryActions = container.querySelector('.summary-actions');

      expect(messages.style.display).toBe('none');
      expect(inputArea.style.display).toBe('none');
      expect(summaryContainer).not.toBeNull();
      expect(summaryActions).not.toBeNull();
    });

    it('shows Keep chatting and Submit buttons', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      const buttons = container.querySelectorAll('.summary-actions .btn');
      expect(buttons).toHaveLength(2);
      expect(buttons[0].textContent).toContain('Keep chatting');
      expect(buttons[1].textContent).toContain('Submit');
    });

    it('renders feedback category badge correctly', () => {
      const feedbackSummary: ReportSummary = {
        ...mockSummary,
        category: 'feedback',
      };
      chatView.showSummary(feedbackSummary);

      const container = chatView.getContainer();
      const badge = container.querySelector('.summary-category-badge');
      expect(badge?.classList.contains('feedback')).toBe(true);
    });

    it('renders feature_request category badge correctly', () => {
      const featureSummary: ReportSummary = {
        ...mockSummary,
        category: 'feature_request',
      };
      chatView.showSummary(featureSummary);

      const container = chatView.getContainer();
      const badge = container.querySelector('.summary-category-badge');
      expect(badge?.classList.contains('feature_request')).toBe(true);
    });

    it('omits steps to reproduce when null', () => {
      const noSteps: ReportSummary = {
        ...mockSummary,
        steps_to_reproduce: null,
      };
      chatView.showSummary(noSteps);

      const container = chatView.getContainer();
      expect(container.querySelector('.summary-steps')).toBeNull();
    });

    it('omits expected/actual behavior when null', () => {
      const noExpected: ReportSummary = {
        ...mockSummary,
        expected_behavior: null,
        actual_behavior: null,
      };
      chatView.showSummary(noExpected);

      const container = chatView.getContainer();
      const labels = container.querySelectorAll('.summary-section-label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).not.toContain('Expected Behavior');
      expect(labelTexts).not.toContain('Actual Behavior');
    });
  });

  describe('showChat()', () => {
    it('returns to chat view from summary view', () => {
      chatView.showSummary(mockSummary);

      const container = chatView.getContainer();
      expect(
        (container.querySelector('.chat-messages') as HTMLElement).style
          .display,
      ).toBe('none');

      chatView.showChat();

      expect(
        (container.querySelector('.chat-messages') as HTMLElement).style
          .display,
      ).toBe('flex');
      expect(
        (container.querySelector('.chat-input-area') as HTMLElement).style
          .display,
      ).toBe('flex');
      expect(container.querySelector('.summary-container')).toBeNull();
    });
  });

  describe('input handling', () => {
    it('sends message on send button click', () => {
      const container = chatView.getContainer();
      document.body.appendChild(container);

      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;
      const sendBtn = container.querySelector(
        '.chat-send-btn',
      ) as HTMLButtonElement;

      input.value = 'Test message';
      input.dispatchEvent(new Event('input'));
      sendBtn.click();

      expect(mockManager.sendMessage).toHaveBeenCalledWith('Test message');
      expect(input.value).toBe('');

      container.remove();
    });

    it('does not send empty messages', () => {
      const container = chatView.getContainer();
      document.body.appendChild(container);

      const sendBtn = container.querySelector(
        '.chat-send-btn',
      ) as HTMLButtonElement;
      sendBtn.click();

      expect(mockManager.sendMessage).not.toHaveBeenCalled();

      container.remove();
    });

    it('sends on Enter key', () => {
      const container = chatView.getContainer();
      document.body.appendChild(container);

      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;
      input.value = 'Enter message';
      input.dispatchEvent(new Event('input'));

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);

      expect(mockManager.sendMessage).toHaveBeenCalledWith('Enter message');

      container.remove();
    });

    it('does not send on Shift+Enter', () => {
      const container = chatView.getContainer();
      document.body.appendChild(container);

      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;
      input.value = 'Multiline';
      input.dispatchEvent(new Event('input'));

      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
      });
      input.dispatchEvent(event);

      expect(mockManager.sendMessage).not.toHaveBeenCalled();

      container.remove();
    });
  });

  describe('destroy()', () => {
    it('removes the container', () => {
      const container = chatView.getContainer();
      document.body.appendChild(container);

      expect(document.body.contains(container)).toBe(true);

      chatView.destroy();

      expect(document.body.contains(container)).toBe(false);
    });
  });

  describe('markdown rendering', () => {
    it('renders markdown in assistant messages on finalize', () => {
      chatView.addAssistantChunk('**bold** and *italic*');
      chatView.finalizeAssistantMessage();

      const container = chatView.getContainer();
      const bubble = container.querySelector('.assistant .chat-bubble');
      expect(bubble?.innerHTML).toContain('<strong>bold</strong>');
      expect(bubble?.innerHTML).toContain('<em>italic</em>');
    });

    it('renders markdown lists on finalize', () => {
      chatView.addAssistantChunk('- item 1\n- item 2');
      chatView.finalizeAssistantMessage();

      const container = chatView.getContainer();
      const bubble = container.querySelector('.assistant .chat-bubble');
      expect(bubble?.innerHTML).toContain('<ul>');
      expect(bubble?.innerHTML).toContain('<li>');
    });

    it('keeps user messages as plain text', () => {
      chatView.addUserMessage('**not bold**');

      const container = chatView.getContainer();
      const bubble = container.querySelector('.user .chat-bubble');
      expect(bubble?.textContent).toBe('**not bold**');
      expect(bubble?.innerHTML).not.toContain('<strong>');
    });

    it('sanitizes HTML in rendered markdown', () => {
      chatView.addAssistantChunk('<script>alert("xss")</script>');
      chatView.finalizeAssistantMessage();

      const container = chatView.getContainer();
      const bubble = container.querySelector('.assistant .chat-bubble');
      expect(bubble?.innerHTML).not.toContain('<script');
    });

    it('shows plain text during streaming, renders markdown on finalize', () => {
      chatView.addAssistantChunk('**bold');
      const container = chatView.getContainer();
      const bubble = container.querySelector('.assistant .chat-bubble');

      // During streaming, content should be plain text
      expect(bubble?.textContent).toContain('**bold');

      chatView.addAssistantChunk('**');
      chatView.finalizeAssistantMessage();

      // After finalize, should be rendered markdown
      expect(bubble?.innerHTML).toContain('<strong>bold</strong>');
    });
  });

  describe('i18n / translations', () => {
    it('uses translation for input placeholder', () => {
      const container = chatView.getContainer();
      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;
      expect(input.placeholder).toBe('Type your message...');
    });

    it('uses Spanish translations when configured', () => {
      const esView = createChatView(
        mockManager,
        {
          onSubmit,
          onCancel,
          onKeepChatting,
        },
        getTranslations('es'),
      );

      const container = esView.getContainer();
      const input = container.querySelector(
        '.chat-input',
      ) as HTMLTextAreaElement;
      expect(input.placeholder).toBe('Escribe tu mensaje...');

      esView.destroy();
    });

    it('uses translated category labels in summary', () => {
      const esView = createChatView(
        mockManager,
        {
          onSubmit,
          onCancel,
          onKeepChatting,
        },
        getTranslations('es'),
      );

      esView.showSummary(mockSummary);

      const container = esView.getContainer();
      const badge = container.querySelector('.summary-category-badge');
      expect(badge?.textContent).toContain('Reporte de error');

      esView.destroy();
    });

    it('uses translated section labels in summary', () => {
      const esView = createChatView(
        mockManager,
        {
          onSubmit,
          onCancel,
          onKeepChatting,
        },
        getTranslations('es'),
      );

      esView.showSummary(mockSummary);

      const container = esView.getContainer();
      const labels = container.querySelectorAll('.summary-section-label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Pasos para reproducir');
      expect(labelTexts).toContain('Comportamiento esperado');
      expect(labelTexts).toContain('Comportamiento actual');

      esView.destroy();
    });

    it('uses translated Keep chatting and Submit buttons', () => {
      const esView = createChatView(
        mockManager,
        {
          onSubmit,
          onCancel,
          onKeepChatting,
        },
        getTranslations('es'),
      );

      esView.showSummary(mockSummary);

      const container = esView.getContainer();
      const buttons = container.querySelectorAll('.summary-actions .btn');
      expect(buttons[0].textContent).toContain('Seguir conversando');
      expect(buttons[1].textContent).toContain('Enviar');

      esView.destroy();
    });
  });
});
