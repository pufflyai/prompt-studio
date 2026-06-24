import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import { waitForSyncEvent } from "../../../test-utils/wait-for-sync-event";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appHandle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let previousDefaultExtensions: string | undefined;
let previousLogTargets: string | undefined;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-notifications-test-"));
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  previousLogTargets = process.env.PSTDIO_LOG_TARGETS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  process.env.PSTDIO_LOG_TARGETS = "stdout";

  appHandle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    extensionWebviewBuilds: false,
  });
  app = appHandle.app;
});

afterAll(async () => {
  await appHandle.close();
  if (previousDefaultExtensions === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  }
  if (previousLogTargets === undefined) {
    delete process.env.PSTDIO_LOG_TARGETS;
  } else {
    process.env.PSTDIO_LOG_TARGETS = previousLogTargets;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

const createProject = async () => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Notifications Project" }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
};

describe("notification routes", () => {
  test("creates, lists, counts, and emits sync events", async () => {
    const project = await createProject();
    const syncEvent = waitForSyncEvent(
      appHandle.eventBus,
      (event) => event.table === "notifications" && event.op === "set",
    );

    const createRes = await app.request(`/v1/projects/${project.id}/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Ticket proposal refined",
        body: "Review PS-95 proposal",
        kind: "needs_review",
        priority: "high",
        target: { type: "ticket", id: "PS-95", label: "PS-95" },
        actions: [
          { id: "review", label: "Review proposal", kind: "open-resource", resource: { type: "ticket", id: "PS-95" } },
        ],
        dedupeKey: "planner:PS-95:review",
      }),
    });

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; title: string; status: string };
    expect(created).toMatchObject({ title: "Ticket proposal refined", status: "open" });
    await expect(syncEvent).resolves.toMatchObject({ table: "notifications", op: "set" });

    const listRes = await app.request(`/v1/projects/${project.id}/notifications`);
    expect(listRes.status).toBe(200);
    await expect(listRes.json()).resolves.toMatchObject({
      items: [{ id: created.id, title: "Ticket proposal refined" }],
    });

    const countRes = await app.request(`/v1/projects/${project.id}/notifications/count`);
    expect(countRes.status).toBe(200);
    await expect(countRes.json()).resolves.toEqual({ count: 1 });
  });

  test("resolves live notifications by dedupe key", async () => {
    const project = await createProject();
    await app.request(`/v1/projects/${project.id}/notifications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Ready to merge",
        kind: "ready_to_merge",
        dedupeKey: "planner:PS-95:ready-to-merge",
      }),
    });

    const resolveRes = await app.request(`/v1/projects/${project.id}/notifications/resolve-by-dedupe-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dedupeKey: "planner:PS-95:ready-to-merge" }),
    });

    expect(resolveRes.status).toBe(200);
    const body = (await resolveRes.json()) as { resolved: number; notifications: Array<{ status: string }> };
    expect(body).toMatchObject({ resolved: 1, notifications: [{ status: "done" }] });
  });
});
