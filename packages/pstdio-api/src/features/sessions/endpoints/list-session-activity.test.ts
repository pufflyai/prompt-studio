import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-list-session-activity-test-"));
  ({ app } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("fake")]),
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "session-activity-project" }),
  });
  expect(projectRes.status).toBe(201);
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/sessions/:id/activity", () => {
  test("supports pagination and filters", async () => {
    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title: "activity session",
        prompt: "activity session",
        agent: testHarnessId("fake"),
      }),
    });
    expect(createRes.status).toBe(201);
    const session = await createRes.json();

    const statusRes = await app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(statusRes.status).toBe(200);

    const archiveRes = await app.request(`/v1/sessions/${session.id}/archive`, { method: "POST" });
    expect(archiveRes.status).toBe(200);

    const firstPageRes = await app.request(`/v1/sessions/${session.id}/activity?limit=1`);
    expect(firstPageRes.status).toBe(200);
    const firstPage = (await firstPageRes.json()) as {
      events: Array<{ event_type: string }>;
      next_cursor: string | null;
    };
    expect(firstPage.events).toHaveLength(1);
    expect(firstPage.next_cursor).toBeTruthy();

    const secondPageRes = await app.request(
      `/v1/sessions/${session.id}/activity?limit=1&cursor=${encodeURIComponent(firstPage.next_cursor!)}`,
    );
    expect(secondPageRes.status).toBe(200);
    const secondPage = (await secondPageRes.json()) as { events: Array<{ event_type: string }> };
    expect(secondPage.events).toHaveLength(1);

    const filteredRes = await app.request(`/v1/sessions/${session.id}/activity?event_type=session_archived`);
    expect(filteredRes.status).toBe(200);
    const filtered = (await filteredRes.json()) as {
      events: Array<{ event_type: string; created_at: string }>;
    };
    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0].event_type).toBe("session_archived");

    const fromRes = await app.request(
      `/v1/sessions/${session.id}/activity?from=${encodeURIComponent(filtered.events[0].created_at)}`,
    );
    expect(fromRes.status).toBe(200);
    const fromFiltered = (await fromRes.json()) as { events: Array<{ event_type: string }> };
    expect(fromFiltered.events.length).toBeGreaterThanOrEqual(1);
  });
});
