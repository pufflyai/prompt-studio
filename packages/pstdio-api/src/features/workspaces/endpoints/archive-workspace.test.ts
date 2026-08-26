import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

let app: OpenAPIHono<AppBindings>;
let appHandle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;
let projectId: string;

let previousPstdioHomeEnv: string | undefined;
let previousDefaultExtensionsEnv: string | undefined;

const createGitRepo = (name: string) => {
  const repoRoot = join(tempRoot, name);
  mkdirSync(repoRoot, { recursive: true });
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "# test\n");
  execSync("git add README.md", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const createWorkspaceAttempt = async (repoRoot: string) => {
  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoRoot }),
  });
  const repo = await repoRes.json();

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, repo_id: repo.id }),
  });
  expect(workspaceRes.status).toBe(201);
  const workspace = (await workspaceRes.json()) as {
    id: string;
    branch: string | null;
    worktree_path: string | null;
    archived: boolean;
  };
  return { workspace };
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-archive-workspace-test-"));
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  appHandle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("echo")]),
  });
  app = appHandle.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "archive-workspace-project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(async () => {
  await appHandle.close();
  if (previousPstdioHomeEnv === undefined) {
    delete process.env.PSTDIO_HOME;
  } else {
    process.env.PSTDIO_HOME = previousPstdioHomeEnv;
  }
  if (previousDefaultExtensionsEnv === undefined) {
    delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  } else {
    process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensionsEnv;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/workspaces/:id/archive", () => {
  test("archives workspace and removes worktree directory", async () => {
    const repoRoot = createGitRepo("archive-workspace-repo");
    const attempt = await createWorkspaceAttempt(repoRoot);
    const { workspace } = attempt;

    expect(workspace.worktree_path).not.toBeNull();
    expect(existsSync(workspace.worktree_path!)).toBe(true);

    const res = await app.request(`/v1/workspaces/${workspace.id}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archived).toBe(true);
    expect(existsSync(workspace.worktree_path!)).toBe(false);

    const activityRes = await app.request(`/v1/workspaces/${workspace.id}/activity`);
    expect(activityRes.status).toBe(200);
    const activity = (await activityRes.json()) as {
      events: Array<{ event_type: string }>;
    };
    expect(activity.events[0].event_type).toBe("workspace_archived");

    const branchOutput = execSync(`git branch --list ${workspace.branch}`, { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(branchOutput).toBe("");
  });

  test("archives all sessions within the workspace", async () => {
    const repoRoot = createGitRepo("archive-sessions-repo");
    const attempt = await createWorkspaceAttempt(repoRoot);
    const { workspace } = attempt;

    // Create a session linked to the workspace
    const sessionRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title: "test session",
        prompt: "hello",
        agent: testHarnessId("echo"),
        workspace_id: workspace.id,
      }),
    });
    expect(sessionRes.status).toBe(201);
    const session = await sessionRes.json();
    expect(session.archived).toBe(false);

    // Archive the workspace
    const res = await app.request(`/v1/workspaces/${workspace.id}/archive`, { method: "POST" });
    expect(res.status).toBe(200);

    // Verify the session is now archived
    const updatedSessionRes = await app.request(`/v1/sessions/${session.id}`);
    const updatedSession = await updatedSessionRes.json();
    expect(updatedSession.archived).toBe(true);
  });

  test("returns 404 when workspace is missing", async () => {
    const res = await app.request("/v1/workspaces/non-existent/archive", {
      method: "POST",
    });

    expect(res.status).toBe(404);
  });
});
