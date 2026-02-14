import type {
  AuthConfig,
  ChatMessage,
  DiagnosticSnapshot,
  ReportSummary,
} from '../types';
import { resolveAuthHeaders } from '../transport/http';
import { streamChat, ChatTransportError } from './chat-transport';

export interface ChatManager {
  start(diagnosticContext: DiagnosticSnapshot): void;
  sendMessage(content: string): void;
  onTextChunk(callback: (text: string) => void): void;
  onSummary(callback: (summary: ReportSummary) => void): void;
  onDone(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  getMessages(): ChatMessage[];
  isStreaming(): boolean;
  abort(): void;
  destroy(): void;
}

const DEFAULT_MAX_MESSAGES = 20;

export function createChatManager(config: {
  endpoint: string;
  auth: AuthConfig;
  maxMessages: number;
}): ChatManager {
  const maxMessages = config.maxMessages ?? DEFAULT_MAX_MESSAGES;

  let messages: ChatMessage[] = [];
  let diagnosticContext: DiagnosticSnapshot | null = null;
  let isFirstRequest = true;
  let streaming = false;
  let abortController: AbortController | null = null;
  let destroyed = false;

  // Callback registrations
  let textChunkCallback: ((text: string) => void) | null = null;
  let summaryCallback: ((summary: ReportSummary) => void) | null = null;
  let doneCallback: (() => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;

  // Track the current assistant message being streamed
  let currentAssistantContent = '';

  function abortCurrent(): void {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    streaming = false;
  }

  async function sendRequest(): Promise<void> {
    if (destroyed) return;

    abortController = new AbortController();
    streaming = true;
    currentAssistantContent = '';

    const context = isFirstRequest ? diagnosticContext : null;
    isFirstRequest = false;

    let authHeaders: Headers;
    try {
      authHeaders = await resolveAuthHeaders(config.auth);
    } catch {
      streaming = false;
      errorCallback?.(new Error('Authentication error'));
      return;
    }

    try {
      await streamChat(
        config.endpoint,
        [...messages],
        context,
        authHeaders,
        (chunk: string) => {
          if (destroyed) return;
          currentAssistantContent += chunk;
          textChunkCallback?.(chunk);
        },
        (summary: ReportSummary) => {
          if (destroyed) return;
          summaryCallback?.(summary);
        },
        () => {
          if (destroyed) return;
          // Finalize the assistant message
          if (currentAssistantContent) {
            messages.push({
              role: 'assistant',
              content: currentAssistantContent,
            });
          }
          streaming = false;
          doneCallback?.();
        },
        abortController.signal,
      );
    } catch (err) {
      streaming = false;
      if (destroyed) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      errorCallback?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  function start(context: DiagnosticSnapshot): void {
    if (destroyed) return;

    // Reset state for a new session
    messages = [];
    diagnosticContext = context;
    isFirstRequest = true;
    abortCurrent();

    void sendRequest();
  }

  function sendMessage(content: string): void {
    if (destroyed) return;

    // Abort any in-flight stream
    abortCurrent();

    messages.push({ role: 'user', content });

    // Check if we've hit the message cap
    if (messages.length >= maxMessages) {
      messages.push({
        role: 'user',
        content: 'Please generate the summary now.',
      });
    }

    void sendRequest();
  }

  function onTextChunk(callback: (text: string) => void): void {
    textChunkCallback = callback;
  }

  function onSummary(callback: (summary: ReportSummary) => void): void {
    summaryCallback = callback;
  }

  function onDone(callback: () => void): void {
    doneCallback = callback;
  }

  function onError(callback: (error: Error) => void): void {
    errorCallback = callback;
  }

  function getMessages(): ChatMessage[] {
    return [...messages];
  }

  function getIsStreaming(): boolean {
    return streaming;
  }

  function abort(): void {
    abortCurrent();
  }

  function destroy(): void {
    destroyed = true;
    abortCurrent();
    messages = [];
    diagnosticContext = null;
    textChunkCallback = null;
    summaryCallback = null;
    doneCallback = null;
    errorCallback = null;
  }

  return {
    start,
    sendMessage,
    onTextChunk,
    onSummary,
    onDone,
    onError,
    getMessages,
    isStreaming: getIsStreaming,
    abort,
    destroy,
  };
}

export { ChatTransportError };
