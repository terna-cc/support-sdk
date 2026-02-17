import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatManager } from '../chat-manager';
import type { DiagnosticSnapshot, ReportSummary } from '../../types';
import type { AttachmentManager } from '../attachment-manager';
import * as chatTransport from '../chat-transport';

// Mock the chat-transport module
vi.mock('../chat-transport', () => ({
  streamChat: vi.fn(),
  ChatTransportError: class ChatTransportError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ChatTransportError';
      this.status = status;
    }
  },
}));

// Mock resolveAuthHeaders
vi.mock('../../transport/http', () => ({
  resolveAuthHeaders: vi.fn(() => Promise.resolve(new Headers())),
}));

const mockDiagnostic: DiagnosticSnapshot = {
  errors: [],
  failedRequests: [],
  consoleErrors: [],
  breadcrumbs: [],
  browser: {
    userAgent: 'test',
    browser: 'Test 1.0',
    os: 'TestOS',
    language: 'en',
    platform: 'test',
    timezone: 'UTC',
    online: true,
    screenWidth: 1920,
    screenHeight: 1080,
    viewportWidth: 1920,
    viewportHeight: 1080,
    devicePixelRatio: 1,
    url: 'https://test.com',
    referrer: '',
  },
  currentUrl: 'https://test.com',
};

const mockSummary: ReportSummary = {
  category: 'bug',
  title: 'Test bug',
  description: 'Something broke',
  steps_to_reproduce: null,
  expected_behavior: null,
  actual_behavior: null,
  severity: 'medium',
  tags: [],
};

function makeManager(
  maxMessages = 20,
  attachmentManager?: AttachmentManager,
) {
  return createChatManager({
    endpoint: 'https://api.test.com',
    auth: { type: 'none' },
    maxMessages,
    attachmentManager,
  });
}

describe('createChatManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start()', () => {
    it('sends initial request with empty messages and diagnostic context', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (
          _endpoint,
          _messages,
          _context,
          _headers,
          _onText,
          _onSummary,
          onDone,
        ) => {
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      // Wait for async work
      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      const [endpoint, messages, context] = streamChatMock.mock.calls[0];
      expect(endpoint).toBe('https://api.test.com');
      expect(messages).toEqual([]);
      expect(context).toEqual(mockDiagnostic);
    });

    it('resets state on new start()', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          if (callCount === 1) {
            onText('First greeting');
            onDone();
          } else {
            onText('Second greeting');
            onDone();
          }
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(callCount).toBe(1);
      });

      // Start again — should reset
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(callCount).toBe(2);
      });

      // Messages should only contain the second greeting's assistant message
      const messages = manager.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Second greeting');
    });
  });

  describe('sendMessage()', () => {
    it('appends user message and sends full history', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          if (callCount === 1) {
            onText('Hello!');
            onDone();
          } else {
            onText('Got it.');
            onDone();
          }
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => expect(callCount).toBe(1));

      manager.sendMessage('I have a bug');

      await vi.waitFor(() => expect(callCount).toBe(2));

      // Second call should have full history
      const [, messages, context] = streamChatMock.mock.calls[1];
      expect(messages).toEqual([
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'I have a bug' },
      ]);
      // Diagnostic context should be null for subsequent requests
      expect(context).toBeNull();
    });
  });

  describe('callbacks', () => {
    it('calls onTextChunk callback for streaming text', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          onText('Hello ');
          onText('world');
          onDone();
        },
      );

      const manager = makeManager();
      const textCallback = vi.fn();
      manager.onTextChunk(textCallback);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(textCallback).toHaveBeenCalledTimes(2);
      });

      expect(textCallback).toHaveBeenNthCalledWith(1, 'Hello ');
      expect(textCallback).toHaveBeenNthCalledWith(2, 'world');
    });

    it('calls onSummary callback', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, onSummary, onDone) => {
          onSummary(mockSummary);
          onDone();
        },
      );

      const manager = makeManager();
      const summaryCallback = vi.fn();
      manager.onSummary(summaryCallback);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(summaryCallback).toHaveBeenCalledOnce();
      });

      expect(summaryCallback).toHaveBeenCalledWith(mockSummary);
    });

    it('calls onDone callback', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, _onSummary, onDone) => {
          onDone();
        },
      );

      const manager = makeManager();
      const doneCallback = vi.fn();
      manager.onDone(doneCallback);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(doneCallback).toHaveBeenCalledOnce();
      });
    });

    it('calls onError callback on stream failure', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockRejectedValue(new Error('Network failure'));

      const manager = makeManager();
      const errorCallback = vi.fn();
      manager.onError(errorCallback);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(errorCallback).toHaveBeenCalledOnce();
      });

      expect(errorCallback.mock.calls[0][0].message).toBe('Network failure');
    });
  });

  describe('message cap', () => {
    it('appends summary request when maxMessages is reached', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          onText(`Response ${callCount}`);
          onDone();
        },
      );

      // Set maxMessages to 4 so we reach it quickly
      const manager = makeManager(4);
      manager.start(mockDiagnostic);
      await vi.waitFor(() => expect(callCount).toBe(1));

      manager.sendMessage('msg1');
      await vi.waitFor(() => expect(callCount).toBe(2));

      // Messages: assistant(1) + user(1) + assistant(2) = 3

      manager.sendMessage('msg2');
      await vi.waitFor(() => expect(callCount).toBe(3));

      // Messages: 3 + user(2) + assistant(3) = 5, but we check BEFORE sending
      // After adding msg2 user message, we have 4 messages which equals maxMessages
      // So it should append "Please generate the summary now."

      const lastCall = streamChatMock.mock.calls[2];
      const sentMessages = lastCall[1];

      // Should contain the summary request message
      const lastMessage = sentMessages[sentMessages.length - 1];
      expect(lastMessage.content).toBe('Please generate the summary now.');
    });
  });

  describe('isStreaming()', () => {
    it('returns true while streaming', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let resolveStream: (() => void) | null = null;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, _onSummary, onDone) => {
          await new Promise<void>((resolve) => {
            resolveStream = () => {
              onDone();
              resolve();
            };
          });
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      // Give time for the async function to start
      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalled();
      });

      expect(manager.isStreaming()).toBe(true);

      resolveStream!();

      await vi.waitFor(() => {
        expect(manager.isStreaming()).toBe(false);
      });
    });
  });

  describe('abort()', () => {
    it('aborts in-flight stream', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let capturedSignal: AbortSignal | null = null;

      streamChatMock.mockImplementation(
        async (
          _ep,
          _msgs,
          _ctx,
          _headers,
          _onText,
          _onSummary,
          _onDone,
          signal,
        ) => {
          capturedSignal = signal;
          // Simulate a long-running stream
          await new Promise<void>((_, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(capturedSignal).not.toBeNull();
      });

      manager.abort();

      expect(capturedSignal!.aborted).toBe(true);
      expect(manager.isStreaming()).toBe(false);
    });
  });

  describe('destroy()', () => {
    it('cleans up state and prevents further operations', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          onText('Hello');
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(manager.getMessages()).toHaveLength(1);
      });

      manager.destroy();

      expect(manager.getMessages()).toEqual([]);
      expect(manager.isStreaming()).toBe(false);
    });
  });

  describe('getLastUserMessage()', () => {
    it('returns null when no user messages exist', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          onText('Hello!');
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(manager.getMessages()).toHaveLength(1);
      });

      expect(manager.getLastUserMessage()).toBeNull();
    });

    it('returns the last user message content', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          onText(`Response ${callCount}`);
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);
      await vi.waitFor(() => expect(callCount).toBe(1));

      manager.sendMessage('First question');
      await vi.waitFor(() => expect(callCount).toBe(2));

      manager.sendMessage('Second question');
      await vi.waitFor(() => expect(callCount).toBe(3));

      expect(manager.getLastUserMessage()).toBe('Second question');
    });
  });

  describe('retry()', () => {
    it('re-sends the last user message', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          onText(`Response ${callCount}`);
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);
      await vi.waitFor(() => expect(callCount).toBe(1));

      manager.sendMessage('My bug report');
      await vi.waitFor(() => expect(callCount).toBe(2));

      manager.retry();
      await vi.waitFor(() => expect(callCount).toBe(3));

      // The retried call should contain the same user message
      const lastCall = streamChatMock.mock.calls[2];
      const sentMessages = lastCall[1];
      const userMessages = sentMessages.filter(
        (m: { role: string }) => m.role === 'user',
      );
      expect(userMessages[userMessages.length - 1].content).toBe(
        'My bug report',
      );
    });

    it('does nothing when streaming is in progress', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let resolveStream: (() => void) | null = null;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, _onSummary, onDone) => {
          await new Promise<void>((resolve) => {
            resolveStream = () => {
              onDone();
              resolve();
            };
          });
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      expect(manager.isStreaming()).toBe(true);

      // Attempt retry while streaming — should no-op
      manager.retry();

      expect(streamChatMock).toHaveBeenCalledOnce();

      resolveStream!();

      await vi.waitFor(() => {
        expect(manager.isStreaming()).toBe(false);
      });
    });

    it('does nothing when no user messages exist', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          onText('Hello!');
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      manager.retry();

      // Should not make additional calls since there's no user message
      expect(streamChatMock).toHaveBeenCalledOnce();
    });
  });

  describe('SSE error event', () => {
    it('calls onError callback when SSE error event is received', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (
          _ep,
          _msgs,
          _ctx,
          _headers,
          _onText,
          _onSummary,
          _onDone,
          _signal,
          _locale,
          onError,
        ) => {
          onError?.('Server error occurred');
        },
      );

      const manager = makeManager();
      const errorCallback = vi.fn();
      manager.onError(errorCallback);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(errorCallback).toHaveBeenCalledOnce();
      });

      expect(errorCallback.mock.calls[0][0].message).toBe(
        'Server error occurred',
      );
    });
  });

  describe('reset()', () => {
    it('does not throw and keeps a consistent state when called before any session', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          onText('Greeting');
          onDone();
        },
      );

      const manager = makeManager();

      // Calling reset before any session should be a no-op and not throw
      expect(() => manager.reset()).not.toThrow();

      // Ensure we are not in a streaming state and no transport calls were made
      expect(manager.isStreaming()).toBe(false);
      expect(manager.getMessages()).toEqual([]);
      expect(streamChatMock).not.toHaveBeenCalled();

      // A subsequent start() should behave normally
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      const [, messages, context] = streamChatMock.mock.calls[0];
      expect(messages).toEqual([]);
      expect(context).toEqual(mockDiagnostic);
      expect(manager.getMessages()).toHaveLength(1);
      expect(manager.getMessages()[0].content).toBe('Greeting');
    });

    it('clears all state so a new session starts fresh', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          if (callCount === 1) {
            onText('First session greeting');
            onDone();
          } else {
            // Second session should receive new diagnostic context
            onText('Second session greeting');
            onDone();
          }
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(callCount).toBe(1);
      });

      // Accumulate some messages
      expect(manager.getMessages()).toHaveLength(1);

      // Reset clears everything
      manager.reset();

      expect(manager.getMessages()).toEqual([]);
      expect(manager.isStreaming()).toBe(false);

      // Start a new session — should work independently
      const newDiagnostic: DiagnosticSnapshot = {
        ...mockDiagnostic,
        currentUrl: 'https://new-session.com',
      };
      manager.start(newDiagnostic);

      await vi.waitFor(() => {
        expect(callCount).toBe(2);
      });

      // The second call should have the new diagnostic context
      const [, messages, context] = streamChatMock.mock.calls[1];
      expect(messages).toEqual([]);
      expect(context).toEqual(newDiagnostic);

      // Messages should only contain the second session's greeting
      expect(manager.getMessages()).toHaveLength(1);
      expect(manager.getMessages()[0].content).toBe('Second session greeting');
    });

    it('does not re-send old diagnostics after reset', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let callCount = 0;

      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          callCount++;
          onText(`Response ${callCount}`);
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);
      await vi.waitFor(() => expect(callCount).toBe(1));

      manager.reset();

      // Send a message without calling start() first
      manager.sendMessage('Hello after reset');
      await vi.waitFor(() => expect(callCount).toBe(2));

      // The context should be null since reset cleared it and isFirstRequest is false
      const [, , context] = streamChatMock.mock.calls[1];
      expect(context).toBeNull();
    });

    it('aborts in-flight stream on reset', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      let capturedSignal: AbortSignal | null = null;

      streamChatMock.mockImplementation(
        async (
          _ep,
          _msgs,
          _ctx,
          _headers,
          _onText,
          _onSummary,
          _onDone,
          signal,
        ) => {
          capturedSignal = signal;
          await new Promise<void>((_, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(capturedSignal).not.toBeNull();
      });

      manager.reset();

      expect(capturedSignal!.aborted).toBe(true);
      expect(manager.isStreaming()).toBe(false);
      expect(manager.getMessages()).toEqual([]);
    });
  });

  describe('attachment metadata', () => {
    it('passes attachment_meta to transport when attachments exist', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, _onSummary, onDone) => {
          onDone();
        },
      );

      const mockAttachmentManager = {
        getAll: () => [
          {
            id: '1',
            file: new File([], 'test.png'),
            name: 'test.png',
            type: 'image/png',
            size: 1234,
          },
          {
            id: '2',
            file: new File([], 'log.txt'),
            name: 'log.txt',
            type: 'text/plain',
            size: 567,
          },
        ],
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        getTotalSize: vi.fn(),
        destroy: vi.fn(),
      } as AttachmentManager;

      const manager = makeManager(20, mockAttachmentManager);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      // attachmentMeta is the last parameter (index 10)
      const attachmentMeta = streamChatMock.mock.calls[0][10];
      expect(attachmentMeta).toEqual([
        { name: 'test.png', type: 'image/png', size: 1234 },
        { name: 'log.txt', type: 'text/plain', size: 567 },
      ]);
    });

    it('does not pass attachment_meta when no attachments exist', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, _onSummary, onDone) => {
          onDone();
        },
      );

      const mockAttachmentManager = {
        getAll: () => [],
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        getTotalSize: vi.fn(),
        destroy: vi.fn(),
      } as AttachmentManager;

      const manager = makeManager(20, mockAttachmentManager);
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      const attachmentMeta = streamChatMock.mock.calls[0][10];
      expect(attachmentMeta).toBeUndefined();
    });

    it('does not pass attachment_meta when no attachment manager is provided', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, _onText, _onSummary, onDone) => {
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(streamChatMock).toHaveBeenCalledOnce();
      });

      const attachmentMeta = streamChatMock.mock.calls[0][10];
      expect(attachmentMeta).toBeUndefined();
    });
  });

  describe('getMessages()', () => {
    it('returns a copy of messages', async () => {
      const streamChatMock = vi.mocked(chatTransport.streamChat);
      streamChatMock.mockImplementation(
        async (_ep, _msgs, _ctx, _headers, onText, _onSummary, onDone) => {
          onText('Hi!');
          onDone();
        },
      );

      const manager = makeManager();
      manager.start(mockDiagnostic);

      await vi.waitFor(() => {
        expect(manager.getMessages()).toHaveLength(1);
      });

      const messages = manager.getMessages();
      messages.push({ role: 'user', content: 'mutated' });

      // Original should be unaffected
      expect(manager.getMessages()).toHaveLength(1);
    });
  });
});
