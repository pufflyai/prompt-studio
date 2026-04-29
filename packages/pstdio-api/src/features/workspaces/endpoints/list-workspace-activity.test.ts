import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-workspace-activity-test-"));
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "workspace-activity-project" }),
  });
  expect(projectRes.status).toBe(201);
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/workspaces/:id/activity", () => {
  test("supports pagination and filters", async () => {
    const ticketRes = await app.request("/v1/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId, content: "workspace activity ticket" }),
    });
    expect(ticketRes.status).toBe(201);
    const ticket = await ticketRes.json();

    const workspaceRes = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        ticket_id: ticket.id,
        ticket_shorthand: ticket.shorthand,
      }),
    });
    expect(workspaceRes.status).toBe(201);
    const workspace = await workspaceRes.json();

    const statusRes = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });
    expect(statusRes.status).toBe(200);

    const archiveRes = await app.request(`/v1/workspaces/${workspace.id}/archive`, { method: "POST" });
    expect(archiveRes.status).toBe(200);

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

    const filteredRes = await app.request(
      `/v1/workspaces/${workspace.id}/activity?event_type=workspace_attempt_status_updated`,
    );
    expect(filteredRes.status).toBe(200);
    const filtered = (await filteredRes.json()) as {
      events: Array<{ event_type: string; created_at: string }>;
    };
    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0].event_type).toBe("workspace_attempt_status_updated");

    const toRes = await app.request(
      `/v1/workspaces/${workspace.id}/activity?to=${encodeURIComponent(filtered.events[0].created_at)}`,
    );
    expect(toRes.status).toBe(200);
    const toFiltered = (await toRes.json()) as { events: Array<{ event_type: string }> };
    expect(toFiltered.events.length).toBeGreaterThanOrEqual(1);
  });
});
