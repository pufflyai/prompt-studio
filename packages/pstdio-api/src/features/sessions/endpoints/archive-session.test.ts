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
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-archive-session-test-"));
  ({ app } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("fake")]),
  }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "archive-session-project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions/:id/archive", () => {
  test("archives a session and emits one activity event", async () => {
    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title: "archive me",
        prompt: "archive me",
        agent: testHarnessId("fake"),
      }),
    });
    expect(createRes.status).toBe(201);
    const session = await createRes.json();

    const archiveRes = await app.request(`/v1/sessions/${session.id}/archive`, { method: "POST" });
    expect(archiveRes.status).toBe(200);

    const activityRes = await app.request(`/v1/sessions/${session.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string }>;
    };
    expect(activity.events[0].event_type).toBe("session_archived");
  });
});
