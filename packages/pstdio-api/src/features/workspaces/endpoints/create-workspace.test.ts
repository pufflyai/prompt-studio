import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let appHandle: Awaited<ReturnType<typeof createTestApp>>;
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
  appHandle = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });
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

  test("renames a workspace without changing stable identifiers", async () => {
    const repoRoot = createGitRepo("rename-workspace-repo");
    await registerRepo(repoRoot);

    const createRes = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const workspace = await createRes.json();

    const renameRes = await app.request(`/v1/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "  Spike - API only  " }),
    });

    expect(renameRes.status).toBe(200);
    const renamed = await renameRes.json();
    expect(renamed.name).toBe("Spike - API only");
    expect(renamed.id).toBe(workspace.id);
    expect(renamed.workspace_shorthand).toBe(workspace.workspace_shorthand);
    expect(renamed.branch).toBe(workspace.branch);
    expect(renamed.worktree_path).toBe(workspace.worktree_path);

    const listRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await listRes.json();
    expect(workspaces.find((item: { id: string }) => item.id === workspace.id).name).toBe("Spike - API only");
  });

  test("rejects duplicate active workspace names", async () => {
    const repoRoot = createGitRepo("duplicate-rename-workspace-repo");
    await registerRepo(repoRoot);

    const createFirstRes = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const first = await createFirstRes.json();
    const createSecondRes = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const second = await createSecondRes.json();

    await app.request(`/v1/workspaces/${first.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Shared label" }),
    });
    const duplicateRes = await app.request(`/v1/workspaces/${second.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Shared label" }),
    });

    expect(duplicateRes.status).toBe(409);
    const unchangedRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    const workspaces = await unchangedRes.json();
    expect(workspaces.find((item: { id: string }) => item.id === second.id).name).toBe(second.name);
  });

  test("rejects invalid or missing workspace rename requests", async () => {
    const blankRes = await app.request("/v1/workspaces/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    expect(blankRes.status).toBe(400);

    const tooLongRes = await app.request("/v1/workspaces/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(121) }),
    });
    expect(tooLongRes.status).toBe(400);

    const missingRes = await app.request("/v1/workspaces/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Spike - API only" }),
    });
    expect(missingRes.status).toBe(404);
  });

  test("rejects default workspace rename", async () => {
    const repoRoot = createGitRepo("default-rename-repo");
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "default-rename-project" }),
    });
    const project = await projectRes.json();
    await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoRoot }),
    });

    const listRes = await app.request(`/v1/workspaces?project_id=${project.id}`);
    const workspaces = await listRes.json();
    const defaultWorkspace = workspaces.find((workspace: { is_default: boolean }) => workspace.is_default);

    const renameRes = await app.request(`/v1/workspaces/${defaultWorkspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New root label" }),
    });

    expect(renameRes.status).toBe(409);
  });
});
