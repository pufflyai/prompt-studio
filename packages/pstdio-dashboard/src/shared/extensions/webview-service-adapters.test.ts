import { expect, test } from "bun:test";
import { createDashboardWebviewNotificationsAdapter } from "./webview-service-adapters";

test("dashboard notification adapters resolve an empty dedupe key by presence", async () => {
  const received: { path: string; body: unknown }[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const body = await request.text();
      received.push({ path: new URL(request.url).pathname, body: body ? JSON.parse(body) : null });
      return Response.json({ resolved: 0, notifications: [] });
    },
  });
  const runtime = globalThis as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const original = runtime.__PSTDIO_CONFIG__;
  try {
    runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
    const adapter = createDashboardWebviewNotificationsAdapter({ projectId: "project-1", extensionId: "notes" });
    await adapter.resolve!({ id: "ignored", dedupeKey: "", status: "dismissed" });
    expect(received).toEqual([
      {
        path: "/v1/projects/project-1/notifications/resolve-by-dedupe-key",
        body: { dedupeKey: "", status: "dismissed" },
      },
    ]);
  } finally {
    runtime.__PSTDIO_CONFIG__ = original;
    server.stop(true);
  }
});
