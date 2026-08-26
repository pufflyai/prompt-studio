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
  const workspace = (await workspaceRes.json()) as { id: string; branch: string | null; worktree_path: string | null };
  return { workspace };
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-delete-workspace-test-"));
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  appHandle = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });
  app = appHandle.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "delete-workspace-project" }),
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

describe("DELETE /v1/workspaces/:id", () => {
  test("soft-deletes workspace and removes worktree directory", async () => {
    const repoRoot = createGitRepo("delete-workspace-repo");
    const attempt = await createWorkspaceAttempt(repoRoot);
    const { workspace } = attempt;

    expect(workspace.worktree_path).not.toBeNull();
    expect(existsSync(workspace.worktree_path!)).toBe(true);

    const res = await app.request(`/v1/workspaces/${workspace.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(existsSync(workspace.worktree_path!)).toBe(false);

    const branchOutput = execSync(`git branch --list ${workspace.branch}`, { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(branchOutput).toBe("");
  });

  test("refuses to delete the default workspace", async () => {
    const repoRoot = createGitRepo("delete-default-repo");
    await createWorkspaceAttempt(repoRoot);

    const defaultWorkspace = await appHandle.deps.workspaceService.getDefault(projectId);
    expect(defaultWorkspace).not.toBeNull();

    const res = await app.request(`/v1/workspaces/${defaultWorkspace!.id}`, { method: "DELETE" });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Default workspace cannot be deleted." });

    const stillPresent = await appHandle.deps.workspaceService.getDefault(projectId);
    expect(stillPresent!.id).toBe(defaultWorkspace!.id);
  });
});
