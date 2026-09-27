import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
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
  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path: repoRoot } } }),
  });
  expect(projectRes.status).toBe(201);
  projectId = (await projectRes.json()).id;

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, provider_id: "pstdio.worktree" }),
  });
  expect(workspaceRes.status).toBe(201);
  const workspace = (await workspaceRes.json()) as { id: string; branch: string | null; root_path: string | null };
  return { workspace };
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-remove-worktree-test-"));
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  appHandle = await createTestApp({ databasePath: ":memory:", storageRoot: join(tempRoot, "storage") });
  app = appHandle.app;

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "remove-worktree-project" })),
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

describe("POST /v1/workspaces/:id/remove-worktree", () => {
  test("removes worktree and branch without deleting the workspace", async () => {
    const repoRoot = createGitRepo("remove-worktree-repo");
    const attempt = await createWorkspaceAttempt(repoRoot);
    const { workspace } = attempt;

    expect(workspace.root_path).not.toBeNull();
    expect(existsSync(workspace.root_path!)).toBe(true);

    const res = await app.request(`/v1/workspaces/${workspace.id}/remove-worktree`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toBe(true);
    expect(existsSync(workspace.root_path!)).toBe(false);

    const branchOutput = execSync(`git branch --list ${workspace.branch}`, { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(branchOutput).toBe("");

    const listRes = await app.request(`/v1/workspaces?project_id=${projectId}`);
    expect(listRes.status).toBe(200);
    const workspaces = (await listRes.json()) as Array<{
      id: string;
      branch: string | null;
      root_path: string | null;
    }>;
    expect(workspaces.find((item) => item.id === workspace.id)).toMatchObject({
      branch: null,
      root_path: null,
    });

    const repeatedRes = await app.request(`/v1/workspaces/${workspace.id}/remove-worktree`, {
      method: "POST",
    });
    expect(repeatedRes.status).toBe(200);
    expect(await repeatedRes.json()).toEqual({ removed: false });
  });

  test("returns 404 when workspace does not exist", async () => {
    const res = await app.request("/v1/workspaces/non-existent/remove-worktree", {
      method: "POST",
    });

    expect(res.status).toBe(404);
  });
});
