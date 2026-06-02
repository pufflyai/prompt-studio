import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

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

const registerRepo = async (repoRoot: string) => {
  const res = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoRoot }),
  });
  return res.json();
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-workspace-test-"));
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  appHandle = await createApp({ dbPath: ":memory:", storagePath: join(tempRoot, "storage"), filesRoot: "" });
  app = appHandle.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "create-workspace-project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(async () => {
  await appHandle.close();
  if (previousPstdioHomeEnv === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHomeEnv;
  if (previousDefaultExtensionsEnv === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensionsEnv;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/workspaces", () => {
  test("creates a worktree-backed workspace without a ticket", async () => {
    const repoRoot = createGitRepo("create-workspace-repo");
    await registerRepo(repoRoot);

    const res = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });

    expect(res.status).toBe(201);
    const workspace = await res.json();

    expect(workspace.workspace_shorthand).toBe("WS-1");
    expect(workspace.branch).toBe("workspace/WS-1");
    expect(workspace.worktree_path).not.toBeNull();
    expect(existsSync(workspace.worktree_path)).toBe(true);

    const listRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await listRes.json();
    expect(workspaces.map((item: { id: string }) => item.id)).toContain(workspace.id);
  });

  test("returns 404 when the project has no repository", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "no-repo-project" }),
    });
    const project = await projectRes.json();

    const res = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id }),
    });

    expect(res.status).toBe(404);
  });
});
