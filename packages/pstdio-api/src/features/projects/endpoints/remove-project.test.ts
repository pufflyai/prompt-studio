import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
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
let storageRoot: string;

let previousPstdioHomeEnv: string | undefined;
let previousDefaultExtensionsEnv: string | undefined;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-remove-project-test-"));
  storageRoot = join(tempRoot, "storage");
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  appHandle = await createTestApp({
    databasePath: ":memory:",
    storageRoot,
  });
  app = appHandle.app;
});

afterAll(async () => {
  await appHandle.close();
  if (previousPstdioHomeEnv === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHomeEnv;
  if (previousDefaultExtensionsEnv === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensionsEnv;
  rmSync(tempRoot, { recursive: true, force: true });
});

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

const createProject = async (name: string) => {
  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<{ id: string; name: string; shorthand: string }>;
};

describe("DELETE /v1/projects/:id", () => {
  test("returns 404 for non-existent project", async () => {
    const res = await app.request("/v1/projects/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  test("hard-deletes an existing project", async () => {
    const project = await createProject("delete-me");

    const res = await app.request(`/v1/projects/${project.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    const getRes = await app.request(`/v1/projects/${project.id}`);
    expect(getRes.status).toBe(404);
  });

  test("hard-deleted project is excluded from list", async () => {
    const project = await createProject("hard-delete-list");

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    const listRes = await app.request("/v1/projects");
    const projects = (await listRes.json()) as { id: string }[];
    const ids = projects.map((p) => p.id);
    expect(ids).not.toContain(project.id);
  });

  test("returns 404 when deleting an already deleted project", async () => {
    const project = await createProject("double-delete");

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    const res = await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  test("removes project storage directory on disk", async () => {
    const project = await createProject("file-cleanup");
    await appHandle.deps.fileService.upload({
      project_id: project.id,
      file_name: "test.txt",
      file_kind: "extension",
      data: Buffer.from("hello"),
      mime_type: "text/plain",
    });

    const projectDir = join(storageRoot, project.id);
    expect(existsSync(projectDir)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(projectDir)).toBe(false);
  });

  test("removes worktree directories on disk", async () => {
    const project = await createProject("worktree-cleanup");

    const repoRoot = createGitRepo("worktree-cleanup-repo");
    const repoRes = await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoRoot }),
    });
    const repo = (await repoRes.json()) as { id: string };

    const workspaceRes = await app.request("/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, repo_id: repo.id }),
    });
    expect(workspaceRes.status).toBe(201);
    const workspace = (await workspaceRes.json()) as { worktree_path: string | null };
    const worktreePath = workspace.worktree_path;

    expect(worktreePath).toBeTruthy();
    expect(existsSync(worktreePath!)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(worktreePath!)).toBe(false);
  });
});
