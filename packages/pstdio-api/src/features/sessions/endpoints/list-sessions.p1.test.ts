import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-list-sessions-test-"));
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });
  app = handle.app;
  const project = await handle.deps.projectService.create({ name: "Sessions project" });
  projectId = project.id;
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("GET /v1/sessions", () => {
  test("filters sessions by linked workspace", async () => {
    const firstWorkspace = await handle.deps.workspaceService.createStandalone({ project_id: projectId });
    const secondWorkspace = await handle.deps.workspaceService.createStandalone({ project_id: projectId });
    const firstSession = await handle.deps.sessionService.create({
      project_id: projectId,
      title: "First workspace session",
      agent: "test-agent",
    });
    const secondSession = await handle.deps.sessionService.create({
      project_id: projectId,
      title: "Second workspace session",
      agent: "test-agent",
    });
    await handle.deps.workspaceSessionService.link(firstWorkspace.id, firstSession.id);
    await handle.deps.workspaceSessionService.link(secondWorkspace.id, secondSession.id);

    const response = await app.request(`/v1/sessions?project_id=${projectId}&workspace_id=${firstWorkspace.id}`);

    expect(response.status).toBe(200);
    const sessions = (await response.json()) as Array<{ id: string }>;
    expect(sessions.map((session) => session.id)).toEqual([firstSession.id]);
  });
});

test("HTTP time and anchor filters use the shared project query", async () => {
  const session = await handle.deps.sessionService.create({
    project_id: projectId,
    title: "anchored",
    agent: "codex",
    anchors: [{ type: "session", id: "query-ticket" }],
  });
  const query = new URLSearchParams({
    project_id: projectId,
    agent: "codex",
    anchor_type: "session",
    anchor_id: "query-ticket",
    created_from: session.created_at,
    created_to: session.created_at,
  });
  const response = await app.request(`/v1/sessions?${query}`);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject([{ id: session.id, usage_json: null, workspace_id: null }]);
  expect((await app.request(`/v1/sessions?project_id=${projectId}&anchor_type=ticket`)).status).toBe(400);
});
