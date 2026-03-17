import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

const previousWorkspacesDirEnv = process.env.PSTDIO_WORKSPACES_DIR;

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

  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "workspace cleanup" }),
  });
  const ticket = await ticketRes.json();

  const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo_id: repo.id, mode: "worktree", start_session: false }),
  });
  return attemptRes.json() as Promise<{
    workspace: { id: string; branch: string | null; worktree_path: string | null; archived: boolean };
  }>;
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-archive-workspace-test-"));
  process.env.PSTDIO_WORKSPACES_DIR = join(tempRoot, "worktrees");
  ({ app } = await createApp({ dbPath: ":memory:", storagePath: join(tempRoot, "storage") }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "archive-workspace-project" }),
  });
  const project = await projectRes.json();
  projectId = project.id;
});

afterAll(() => {
  if (previousWorkspacesDirEnv === undefined) {
    delete process.env.PSTDIO_WORKSPACES_DIR;
  } else {
    process.env.PSTDIO_WORKSPACES_DIR = previousWorkspacesDirEnv;
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

    const branchOutput = execSync(`git branch --list ${workspace.branch}`, { cwd: repoRoot, encoding: "utf8" }).trim();
    expect(branchOutput).toBe("");
  });

  test("returns 404 when workspace is missing", async () => {
    const res = await app.request("/v1/workspaces/non-existent/archive", {
      method: "POST",
    });

    expect(res.status).toBe(404);
  });
});
