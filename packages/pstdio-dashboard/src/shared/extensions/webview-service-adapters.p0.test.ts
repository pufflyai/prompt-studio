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
    const adapter = createDashboardWebviewNotificationsAdapter({
      showNotice: () => {},
      projectId: "project-1",
      extensionId: "notes",
      showError: () => {},
    });
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

test("webview errors are returned to the originating view", () => {
  const errors: unknown[] = [];
  const notices: unknown[] = [];
  const adapter = createDashboardWebviewNotificationsAdapter({
    extensionId: "notes",
    showNotice: (notice) => notices.push(notice),
    showError: (error) => errors.push(error),
  });
  adapter.show!({ type: "error", title: "Save failed", message: "Read-only file" });
  expect(errors).toEqual([{ title: "Save failed", description: "Read-only file" }]);
  adapter.show!({ type: "success", title: "Saved", message: "Saved in this view" });
  expect(notices).toEqual([{ type: "success", title: "Saved", description: "Saved in this view" }]);
});
