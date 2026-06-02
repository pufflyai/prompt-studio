import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-attempt-status-noop-test-"));
  const created = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [],
  });
  app = created.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "attempt-status-noop-project" }),
  });
  expect(projectRes.status).toBe(201);
  const project = await projectRes.json();
  projectId = project.id;

  const repoDir = join(tempRoot, "repo");
  mkdirSync(repoDir, { recursive: true });
  await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-repo", path: repoDir }),
  });
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

const createWorkspace = async () => {
  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  expect(workspaceRes.status).toBe(201);
  return workspaceRes.json();
};

describe("PATCH /v1/workspaces/:id/attempt-status no-op", () => {
  test("does not emit duplicate activity for repeated status", async () => {
    const workspace = await createWorkspace();

    const firstRes = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });
    expect(firstRes.status).toBe(200);

    const secondRes = await app.request(`/v1/workspaces/${workspace.id}/attempt-status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "review-ready" }),
    });
    expect(secondRes.status).toBe(200);

    const activityRes = await app.request(
      `/v1/workspaces/${workspace.id}/activity?event_type=workspace_attempt_status_updated`,
    );
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as { events: Array<{ event_type: string }> };
    expect(activity.events).toHaveLength(1);
    expect(activity.events[0].event_type).toBe("workspace_attempt_status_updated");
  });
});
