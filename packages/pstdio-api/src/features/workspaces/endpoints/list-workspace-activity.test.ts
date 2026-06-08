import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appHandle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-workspace-activity-test-"));
  appHandle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  });
  app = appHandle.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "workspace-activity-project" }),
  });
  expect(projectRes.status).toBe(201);
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(async () => {
  await appHandle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/workspaces/:id/activity", () => {
  test("supports pagination and filters", async () => {
    const workspace = await appHandle.deps.workspaceService.createStandalone({ project_id: projectId });

    await appHandle.deps.activityEventsService.create({
      projectId,
      resourceType: "workspace",
      resourceId: workspace.id,
      eventType: "workspace_note",
      actorType: "system",
      source: "api",
      summary: "Added workspace note",
      payloadJson: {},
    });

    await appHandle.deps.activityEventsService.create({
      projectId,
      resourceType: "workspace",
      resourceId: workspace.id,
      eventType: "workspace_archived",
      actorType: "system",
      source: "api",
      summary: "Archived workspace",
      payloadJson: {},
    });

    const firstPageRes = await app.request(`/v1/workspaces/${workspace.id}/activity?limit=1`);
    expect(firstPageRes.status).toBe(200);
    const firstPage = (await firstPageRes.json()) as {
      events: Array<{ event_type: string }>;
      next_cursor: string | null;
    };
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.next_cursor).toBeTruthy();

    const secondPageRes = await app.request(
      `/v1/workspaces/${workspace.id}/activity?limit=1&cursor=${encodeURIComponent(firstPage.next_cursor!)}`,
    );
    expect(secondPageRes.status).toBe(200);
    const secondPage = (await secondPageRes.json()) as { events: Array<{ event_type: string }> };
    expect(secondPage.events).toHaveLength(1);

    const filteredRes = await app.request(`/v1/workspaces/${workspace.id}/activity?event_type=workspace_archived`);
    expect(filteredRes.status).toBe(200);
    const filtered = (await filteredRes.json()) as {
      events: Array<{ event_type: string; created_at: string }>;
    };
    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0].event_type).toBe("workspace_archived");

    const toRes = await app.request(
      `/v1/workspaces/${workspace.id}/activity?to=${encodeURIComponent(filtered.events[0].created_at)}`,
    );
    expect(toRes.status).toBe(200);
    const toFiltered = (await toRes.json()) as { events: Array<{ event_type: string }> };
    expect(toFiltered.events.length).toBeGreaterThanOrEqual(1);
  });
});
