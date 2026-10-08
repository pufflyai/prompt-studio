import { expect, test } from "bun:test";
import { createRequest } from "./request";

test("reports a lost backend connection separately from an API error", async () => {
  const server = Bun.serve({ port: 0, fetch: () => Response.json({ ok: true }) });
  const request = createRequest({ baseUrl: server.url.origin });
  expect(await request<{ ok: boolean }>("/health")).toEqual({ ok: true });
  await server.stop(true);

  await expect(request("/health")).rejects.toMatchObject({ name: "PstdioConnectionError" });
});

test("keeps a cancelled request distinct from a lost connection", async () => {
  const server = Bun.serve({ port: 0, fetch: () => Response.json({ ok: true }) });
  const controller = new AbortController();
  const reason = new Error("View no longer active");
  controller.abort(reason);
  try {
    await expect(createRequest({ baseUrl: server.url.origin })("/health", { signal: controller.signal })).rejects.toBe(
      reason,
    );
  } finally {
    await server.stop(true);
  }
});

test("reports a connection dropped while reading the response body", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"ok":'));
            setTimeout(() => controller.error(new Error("Connection closed")), 20);
          },
        }),
      ),
  });
  try {
    await expect(createRequest({ baseUrl: server.url.origin })("/health")).rejects.toMatchObject({
      name: "PstdioConnectionError",
    });
  } finally {
    await server.stop(true);
  }
});

test("keeps invalid response data distinct from a lost connection", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response("invalid json") });
  try {
    await expect(createRequest({ baseUrl: server.url.origin })("/health")).rejects.toBeInstanceOf(SyntaxError);
  } finally {
    await server.stop(true);
  }
});
