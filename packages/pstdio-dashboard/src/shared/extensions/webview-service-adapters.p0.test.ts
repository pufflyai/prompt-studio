import { expect, test } from "bun:test";
import type { Notification } from "@pstdio/sdk/api";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeCollections } from "@/lib/sync/collections";
import { getNotificationStatusOperations } from "@/shared/notifications/notification-status-operations";
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

test("resolving a notification by ID previews its status in the shared center", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const paths: string[] = [];
  const confirmed: Notification = {
    id: "notice",
    projectId: "project",
    title: "Task finished",
    status: "done",
    kind: "info",
    origin: "extension",
    priority: "normal",
    source: "dashboard",
    actions: [],
    related: [],
    createdAt: "2026-08-01T12:30:00.000Z",
    updatedAt: "2026-08-01T12:31:00.000Z",
  };
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (!path.includes("/notifications/")) return new Response(null, { status: 404 });
      paths.push(path);
      if (request.method === "POST") {
        entered.resolve();
        await release.promise;
      }
      return Response.json(confirmed);
    },
  });
  const config = globalThis as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const original = config.__PSTDIO_CONFIG__;
  config.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const statuses = getNotificationStatusOperations(runtime);
  try {
    runtime.getCollection("notifications");
    const writer = runtime.getWriter("notifications")!;
    writer.upsert({ id: "notice", project_id: "project", status: "open", title: confirmed.title });
    const adapter = createDashboardWebviewNotificationsAdapter({
      runtime,
      projectId: "project",
      extensionId: "notes",
      showError: () => {},
      showNotice: () => {},
    });
    const resolving = adapter.resolve!({ id: "notice" });
    void resolving.catch(() => {});
    await entered.promise;
    expect(statuses.readPatches("project").get("notice")).toBe("done");
    expect(statuses.readPatches("other-project").size).toBe(0);
    release.resolve();
    expect(await resolving).toEqual(confirmed);
    expect(paths).toEqual([
      "/v1/projects/project/notifications/notice/status",
      "/v1/projects/project/notifications/notice",
    ]);
    expect(statuses.readPatches("project").size).toBe(0);
    expect(runtime.getCollection("notifications").state.get("notice")?.status).toBe("done");
  } finally {
    release.resolve();
    config.__PSTDIO_CONFIG__ = original;
    await runtime.dispose();
    await server.stop(true);
  }
});

test("exact expiry retires an unknown resolve and settles a queued dismissal", async () => {
  const expired = { projectId: "project", id: "notice", status: "expired" };
  let writes = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (!path.includes("/notifications/")) return new Response(null, { status: 404 });
      if (request.method === "POST") {
        writes += 1;
        return Response.json({ error: "Response lost" }, { status: 503 });
      }
      return Response.json(expired);
    },
  });
  const runtime = createRuntimeCollections({ baseUrl: server.url.origin, token: "" });
  const operations = getWorkbenchOperations(getDashboardScopedQueries(runtime));
  try {
    runtime.getCollection("notifications");
    runtime.getWriter("notifications")!.upsert({ id: "notice", project_id: "project", status: "open" });
    const adapter = createDashboardWebviewNotificationsAdapter({
      runtime,
      projectId: "project",
      extensionId: "notes",
      showError: () => {},
      showNotice: () => {},
    });
    await expect(adapter.resolve!({ id: "notice" })).rejects.toThrow("Response lost");
    const recovery = operations.getSnapshot().recovery[0]!;
    const dismissing = adapter.resolve!({ id: "notice", status: "dismissed" });
    void dismissing.catch(() => {});
    await operations.check(recovery.id);
    expect(operations.getSnapshot().recovery.find(({ id }) => id === recovery.id)?.status).toBe("rejected");
    await expect(dismissing).rejects.toThrow("expired");
    expect(operations.getSnapshot().pending).toEqual([]);
    expect(writes).toBe(1);
  } finally {
    await runtime.dispose();
    await server.stop(true);
  }
});
