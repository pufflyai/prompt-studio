import { describe, expect, mock, test } from "bun:test";
import { contribution, createConnectionTestService } from "./extension-connection-service.test-fixture";

describe("extension connection transport", () => {
  test("cancels a chunked response as soon as it exceeds the byte limit", async () => {
    const chunks = [new Uint8Array(4 * 1024 * 1024), new Uint8Array(2 * 1024 * 1024)];
    const cancel = mock(async () => {});
    const responseBody = {
      getReader: () => ({
        read: async () => {
          const value = chunks.shift();
          return value ? { done: false as const, value } : { done: true as const, value: undefined };
        },
        cancel,
      }),
    } as unknown as ReadableStream<Uint8Array>;
    const service = createConnectionTestService((async () => ({
      status: 200,
      headers: new Headers(),
      body: responseBody,
    })) as unknown as typeof fetch);

    await expect(
      service.request({
        projectId: "project-1",
        extensionId: "pstdio.remote",
        connectionId: "control-plane",
        input: { method: "GET", path: "/v1/workspaces/remote-1" },
      }),
    ).rejects.toThrow("too large");
    expect(cancel).toHaveBeenCalled();
  });

  test("rejects a credential reflected in a different header or buffered body", async () => {
    const inputs = [
      new Response("ok", { headers: { "x-reflected-credential": "credential-canary" } }),
      Response.json({ reflected: "credential-canary" }),
      new Response('{"reflected":"credential\\u002dcanary"}', {
        headers: { "content-type": "application/json" },
      }),
      new Response("prefix credential-canary suffix"),
    ];

    for (const upstream of inputs) {
      const service = createConnectionTestService((async () => upstream) as unknown as typeof fetch);
      await expect(
        service.request({
          projectId: "project-1",
          extensionId: "pstdio.remote",
          connectionId: "control-plane",
          input: { method: "GET", path: "/v1/workspaces/remote-1" },
        }),
      ).rejects.toThrow("reflected");
    }
  });

  test("rejects a credential reflected across streaming chunk boundaries", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("prefix credential-"));
        controller.enqueue(encoder.encode("canary suffix"));
        controller.close();
      },
    });
    const service = createConnectionTestService((async () => new Response(body)) as unknown as typeof fetch, {
      ...contribution,
      supportsStreaming: true,
    });

    const consume = async () => {
      for await (const _event of service.stream({
        projectId: "project-1",
        extensionId: "pstdio.remote",
        connectionId: "control-plane",
        input: { method: "GET", path: "/v1/workspaces/remote-1" },
      })) {
        // Consume every event so a reflected secret cannot hide in a later chunk.
      }
    };

    await expect(consume()).rejects.toThrow("reflected");
  });

  test("cancels the upstream body when a stream consumer stops early", async () => {
    const cancel = mock(async () => {});
    const responseBody = { cancel } as unknown as ReadableStream<Uint8Array>;
    const service = createConnectionTestService(
      (async () => ({ status: 200, headers: new Headers(), body: responseBody })) as unknown as typeof fetch,
      { ...contribution, supportsStreaming: true },
    );
    const iterator = service
      .stream({
        projectId: "project-1",
        extensionId: "pstdio.remote",
        connectionId: "control-plane",
        input: { method: "GET", path: "/v1/workspaces/remote-1" },
      })
      [Symbol.asyncIterator]();

    expect(await iterator.next()).toMatchObject({ value: { type: "response" }, done: false });
    await iterator.return?.();

    expect(cancel).toHaveBeenCalled();
  });
});
