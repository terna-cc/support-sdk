import type {
  AttachmentMetadata,
  ChatMessage,
  DiagnosticSnapshot,
  ReportSummary,
} from '../types';

export async function streamChat(
  endpoint: string,
  messages: ChatMessage[],
  diagnosticContext: DiagnosticSnapshot | null,
  authHeaders: Headers,
  onText: (chunk: string) => void,
  onSummary: (summary: ReportSummary) => void,
  onDone: () => void,
  signal: AbortSignal,
  locale?: string,
  onError?: (message: string) => void,
  attachmentMeta?: AttachmentMetadata[],
): Promise<void> {
  const url = `${endpoint.replace(/\/+$/, '')}/chat`;

  const headers = new Headers(authHeaders);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'text/event-stream');

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      diagnostic_context: diagnosticContext,
      ...(attachmentMeta ? { attachment_meta: attachmentMeta } : {}),
      ...(locale ? { locale } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    throw new ChatTransportError(
      response.status,
      await getErrorMessage(response),
    );
  }

  if (!response.body) {
    throw new ChatTransportError(0, 'Response body is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const parts = sseBuffer.split('\n\n');
      sseBuffer = parts.pop()!;

      for (const part of parts) {
        const dataLine = part.replace(/^data: /, '');
        if (!dataLine) continue;

        let parsed: { type: string; content?: string; data?: ReportSummary };
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }

        switch (parsed.type) {
          case 'text':
            if (parsed.content) {
              onText(parsed.content);
            }
            break;
          case 'summary':
            if (parsed.data) {
              onSummary(parsed.data);
            }
            break;
          case 'error':
            onError?.(typeof parsed.content === 'string' ? parsed.content : '');
            return;
          case 'done':
            onDone();
            return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // If stream ended without a done event, still signal done
  onDone();
}

export class ChatTransportError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ChatTransportError';
    this.status = status;
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.text();
    const parsed = JSON.parse(body);
    if (parsed.message) return parsed.message;
  } catch {
    // ignore
  }

  if (response.status === 404) return 'Chat endpoint not found';
  if (response.status === 401 || response.status === 403)
    return 'Authentication error';
  if (response.status >= 500) return 'Server error';
  return `Request failed (${response.status})`;
}
