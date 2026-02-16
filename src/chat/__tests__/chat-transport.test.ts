import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamChat, ChatTransportError } from '../chat-transport';
import type { ReportSummary } from '../../types';

function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchWithStream(
  chunks: string[],
  status = 200,
): ReturnType<typeof vi.fn> {
  return vi.fn(() =>
    Promise.resolve(
      new Response(createReadableStream(chunks), {
        status,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    ),
  );
}

describe('streamChat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends POST to {endpoint}/chat with correct body', async () => {
    let capturedUrl = '';
    let capturedBody = '';
    let capturedHeaders: Headers | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedBody = init.body as string;
        capturedHeaders = init.headers as Headers;
        return Promise.resolve(
          new Response(createReadableStream(['data: {"type":"done"}\n\n']), {
            status: 200,
          }),
        );
      }),
    );

    const authHeaders = new Headers();
    authHeaders.set('Authorization', 'Bearer test-token');

    const onText = vi.fn();
    const onSummary = vi.fn();
    const onDone = vi.fn();
    const controller = new AbortController();

    await streamChat(
      'https://api.test.com',
      [{ role: 'user', content: 'Hello' }],
      {
        errors: [],
        failedRequests: [],
        consoleErrors: [],
        breadcrumbs: [],
        browser: {} as never,
        currentUrl: 'https://test.com',
      },
      authHeaders,
      onText,
      onSummary,
      onDone,
      controller.signal,
    );

    expect(capturedUrl).toBe('https://api.test.com/chat');

    const body = JSON.parse(capturedBody);
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(body.diagnostic_context).toBeTruthy();

    expect(capturedHeaders!.get('Authorization')).toBe('Bearer test-token');
    expect(capturedHeaders!.get('Content-Type')).toBe('application/json');
    expect(capturedHeaders!.get('Accept')).toBe('text/event-stream');
  });

  it('strips trailing slash from endpoint', async () => {
    let capturedUrl = '';

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        capturedUrl = url;
        return Promise.resolve(
          new Response(createReadableStream(['data: {"type":"done"}\n\n']), {
            status: 200,
          }),
        );
      }),
    );

    await streamChat(
      'https://api.test.com/',
      [],
      null,
      new Headers(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
    );

    expect(capturedUrl).toBe('https://api.test.com/chat');
  });

  it('parses text events and calls onText', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchWithStream([
        'data: {"type":"text","content":"Hello "}\n\n',
        'data: {"type":"text","content":"world"}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    );

    const onText = vi.fn();
    const onDone = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      onText,
      vi.fn(),
      onDone,
      new AbortController().signal,
    );

    expect(onText).toHaveBeenCalledTimes(2);
    expect(onText).toHaveBeenNthCalledWith(1, 'Hello ');
    expect(onText).toHaveBeenNthCalledWith(2, 'world');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('parses summary events and calls onSummary', async () => {
    const summary: ReportSummary = {
      category: 'bug',
      title: 'Test bug',
      description: 'Something broke',
      steps_to_reproduce: ['Step 1'],
      expected_behavior: 'It works',
      actual_behavior: 'It broke',
      severity: 'high',
      tags: ['test'],
    };

    vi.stubGlobal(
      'fetch',
      mockFetchWithStream([
        `data: {"type":"summary","data":${JSON.stringify(summary)}}\n\n`,
        'data: {"type":"done"}\n\n',
      ]),
    );

    const onSummary = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      vi.fn(),
      onSummary,
      vi.fn(),
      new AbortController().signal,
    );

    expect(onSummary).toHaveBeenCalledOnce();
    expect(onSummary).toHaveBeenCalledWith(summary);
  });

  it('handles chunks split across reads', async () => {
    // SSE event split across two chunks
    vi.stubGlobal(
      'fetch',
      mockFetchWithStream([
        'data: {"type":"text","con',
        'tent":"hello"}\n\ndata: {"type":"done"}\n\n',
      ]),
    );

    const onText = vi.fn();
    const onDone = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      onText,
      vi.fn(),
      onDone,
      new AbortController().signal,
    );

    expect(onText).toHaveBeenCalledWith('hello');
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('calls onDone if stream ends without done event', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchWithStream(['data: {"type":"text","content":"hi"}\n\n']),
    );

    const onDone = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      vi.fn(),
      vi.fn(),
      onDone,
      new AbortController().signal,
    );

    expect(onDone).toHaveBeenCalledOnce();
  });

  it('throws ChatTransportError on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'Not found' }), {
            status: 404,
          }),
        ),
      ),
    );

    await expect(
      streamChat(
        'https://api.test.com',
        [],
        null,
        new Headers(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow(ChatTransportError);
  });

  it('ChatTransportError has correct status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 }))),
    );

    try {
      await streamChat(
        'https://api.test.com',
        [],
        null,
        new Headers(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        new AbortController().signal,
      );
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ChatTransportError);
      expect((err as ChatTransportError).status).toBe(404);
    }
  });

  it('supports AbortController cancellation', async () => {
    const controller = new AbortController();

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, _init: RequestInit) => {
        // Abort immediately
        controller.abort();
        const abortError = new DOMException('Aborted', 'AbortError');
        return Promise.reject(abortError);
      }),
    );

    await expect(
      streamChat(
        'https://api.test.com',
        [],
        null,
        new Headers(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        controller.signal,
      ),
    ).rejects.toThrow('Aborted');
  });

  it('skips invalid JSON in SSE events', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchWithStream([
        'data: not valid json\n\n',
        'data: {"type":"text","content":"valid"}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    );

    const onText = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      onText,
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
    );

    expect(onText).toHaveBeenCalledOnce();
    expect(onText).toHaveBeenCalledWith('valid');
  });

  it('sends null diagnostic_context when provided as null', async () => {
    let capturedBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(
          new Response(createReadableStream(['data: {"type":"done"}\n\n']), {
            status: 200,
          }),
        );
      }),
    );

    await streamChat(
      'https://api.test.com',
      [{ role: 'user', content: 'test' }],
      null,
      new Headers(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
    );

    const body = JSON.parse(capturedBody);
    expect(body.diagnostic_context).toBeNull();
  });

  it('includes locale in request body when provided', async () => {
    let capturedBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(
          new Response(createReadableStream(['data: {"type":"done"}\n\n']), {
            status: 200,
          }),
        );
      }),
    );

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
      'es',
    );

    const body = JSON.parse(capturedBody);
    expect(body.locale).toBe('es');
  });

  it('parses error events and calls onError', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchWithStream([
        'data: {"type":"error","content":"Something went wrong"}\n\n',
      ]),
    );

    const onText = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      onText,
      vi.fn(),
      onDone,
      new AbortController().signal,
      undefined,
      onError,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('Something went wrong');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('passes empty string to onError when error event has no content', async () => {
    vi.stubGlobal('fetch', mockFetchWithStream(['data: {"type":"error"}\n\n']));

    const onError = vi.fn();

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
      undefined,
      onError,
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith('');
  });

  it('omits locale from request body when not provided', async () => {
    let capturedBody = '';

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        capturedBody = init.body as string;
        return Promise.resolve(
          new Response(createReadableStream(['data: {"type":"done"}\n\n']), {
            status: 200,
          }),
        );
      }),
    );

    await streamChat(
      'https://api.test.com',
      [],
      null,
      new Headers(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      new AbortController().signal,
    );

    const body = JSON.parse(capturedBody);
    expect(body.locale).toBeUndefined();
  });
});
