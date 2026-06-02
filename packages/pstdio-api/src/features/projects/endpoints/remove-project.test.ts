import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let storagePath: string;

let previousPstdioHomeEnv: string | undefined;
let previousDefaultExtensionsEnv: string | undefined;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-remove-project-test-"));
  storagePath = join(tempRoot, "storage");
  previousPstdioHomeEnv = process.env.PSTDIO_HOME;
  previousDefaultExtensionsEnv = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "pstdio-home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath,
    filesRoot: "",
  }));
});

afterAll(() => {
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

const createTicket = async (projectId: string) => {
  const res = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "test ticket" }),
  });
  return res.json() as Promise<{ id: string; shorthand: string }>;
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
    const ticket = await createTicket(project.id);

    await app.request(`/v1/tickets/${ticket.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        file_name: "test.txt",
        content_base64: Buffer.from("hello").toString("base64"),
      }),
    });

    const projectDir = join(storagePath, project.id);
    expect(existsSync(projectDir)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(projectDir)).toBe(false);
  });

  test("removes worktree directories on disk", async () => {
    const project = await createProject("worktree-cleanup");
    const ticket = await createTicket(project.id);

    const repoRoot = createGitRepo("worktree-cleanup-repo");
    await app.request(`/v1/projects/${project.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "repo", path: repoRoot }),
    });

    const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "worktree", start_session: false }),
    });
    const { workspace } = await attemptRes.json();
    const worktreePath = workspace.worktree_path as string;

    expect(worktreePath).toBeTruthy();
    expect(existsSync(worktreePath)).toBe(true);

    await app.request(`/v1/projects/${project.id}`, { method: "DELETE" });

    expect(existsSync(worktreePath)).toBe(false);
  });
});
