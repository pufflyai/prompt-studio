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
  it("uploads and deletes session attachments through the sdk client", async () => {
    const calls: Array<{ url: string; method: string; headers: Headers; body?: BodyInit | null }> = [];
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: init?.body,
      });

      if (calls.length === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              file_id: "file-1",
              name: "notes.txt",
              mime_type: "text/plain",
              size_bytes: 5,
              hash: null,
              url: "/content",
              created_at: "2026-06-17T10:00:00.000Z",
              updated_at: "2026-06-17T10:00:00.000Z",
            }),
            { status: 201 },
          ),
        );
      }

      return Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    const client = createClient({ baseUrl: "http://test:1234", fetch: fetchFn });

    const uploaded = await client.sessions.uploadAttachment("project 1", {
      name: "notes.txt",
      data: new TextEncoder().encode("hello"),
      mimeType: "text/plain",
    });
    await client.sessions.deleteAttachment("project 1", uploaded.file_id);

    expect(calls[0]).toMatchObject({
      url: "http://test:1234/v1/projects/project%201/session-attachments",
      method: "POST",
    });
    expect(calls[0]!.headers.get("content-type")).toBe("text/plain");
    expect(calls[0]!.headers.get("x-file-name")).toBe("notes.txt");
    expect(calls[0]!.body).toBeInstanceOf(Uint8Array);
    expect(calls[1]).toMatchObject({
      url: "http://test:1234/v1/projects/project%201/session-attachments/file-1",
      method: "DELETE",
    });
  });

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
