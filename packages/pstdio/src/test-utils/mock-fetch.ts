import { afterEach, mock } from "bun:test";
import { resetApiClient } from "@/features/api-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClient();
});

export const mockFetch = (status: number, body?: unknown) => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(body != null ? JSON.stringify(body) : null, { status })),
  ) as unknown as typeof fetch;
};

export const mockFetchSequence = (responses: { status: number; body: unknown }[]) => {
  let callIndex = 0;
  globalThis.fetch = mock(() => {
    const resp = responses[callIndex++];
    if (!resp) return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify(resp.body), { status: resp.status }));
  }) as unknown as typeof fetch;
};

const sseMessage = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const mockFetchSSE = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const handle = {
    send: (event: string, data: unknown) => controller.enqueue(encoder.encode(sseMessage(event, data))),
    close: () => controller.close(),
  };

  const fetchMock = mock(() =>
    Promise.resolve(new Response(stream, { headers: { "content-type": "text/event-stream" } })),
  );
  globalThis.fetch = Object.assign(fetchMock, {
    preconnect: originalFetch.preconnect,
  }) as typeof fetch;

  return handle;
};
