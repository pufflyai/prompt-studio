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
  await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path: repoRoot }),
  });

  const workspaceName = `WS-${crypto.randomUUID().slice(0, 8)}`;
  const branch = `workspace/${workspaceName}`;
  const worktreePath = join(tempRoot, "worktrees", workspaceName);
  execSync(`git worktree add -b ${branch} ${worktreePath}`, { cwd: repoRoot, stdio: "pipe" });

  const workspaceRes = await app.request("/v1/workspaces", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      name: workspaceName,
      branch,
      worktree_path: worktreePath,
      anchors: [
        { type: "pstdio.planner.ticket", id: workspaceName, label: workspaceName, extensionId: "pstdio.planner" },
      ],
    }),
  });
  const workspace = await workspaceRes.json();
  return {
    workspace,
  } as {
    workspace: { id: string; branch: string | null; worktree_path: string | null };
  };
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-delete-workspace-test-"));
  process.env.PSTDIO_WORKSPACES_DIR = join(tempRoot, "worktrees");
  ({ app } = await createApp({ dbPath: ":memory:", storagePath: join(tempRoot, "storage"), filesRoot: "" }));

  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "delete-workspace-project" }),
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
});
