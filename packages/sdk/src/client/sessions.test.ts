import { describe, expect, it } from "bun:test";
import { createClient } from "./client";

const createSseResponse = (chunks: string[]) => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, { status: 200 });
};

describe("session stream client", () => {
  it("streams session SSE events through the sdk client", async () => {
    const calls: string[] = [];
    const events: { event: string; data: string }[] = [];
    const fetchFn = ((url: string) => {
      calls.push(String(url));
      return Promise.resolve(
        createSseResponse([
          'event: ready\ndata: {"sessionId":"s_1"}\n\n',
          'event: patch\ndata: {"op":"add","path":"/messages/0","value":{"text":"hi"}}\n\n',
        ]),
      );
    }) as unknown as typeof fetch;
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    await client.sessions.stream("s_1", (event) => events.push(event));

    expect(calls).toEqual(["http://test:1234/v1/sessions/s_1/stream"]);
    expect(events).toEqual([
      { event: "ready", data: '{"sessionId":"s_1"}' },
      { event: "patch", data: '{"op":"add","path":"/messages/0","value":{"text":"hi"}}' },
    ]);
  });

  it("connects browser session streams through authenticated fetch", async () => {
    const calls: Array<{ url: string; auth: string | null; signal?: AbortSignal | null }> = [];
    const events: string[] = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        auth: new Headers(init?.headers).get("authorization"),
        signal: init?.signal ?? null,
      });
      return Promise.resolve(createSseResponse(['event: ready\ndata: {"sessionId":"s_1"}\n\n']));
    }) as unknown as typeof fetch;
    const client = createClient({
      baseUrl: "http://test:1234",
      fetch: fetchFn,
      token: "secret",
    });

    const connection = client.sessions.connectStream(
      "s_1",
      {
        onReady: () => events.push("ready"),
      },
      { attempt: 2 },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.close();

    expect(calls).toEqual([
      {
        url: "http://test:1234/v1/sessions/s_1/stream?attempt=2",
        auth: "Bearer secret",
        signal: calls[0]!.signal,
      },
    ]);
    expect(calls[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(events).toEqual(["ready"]);
  });
});
