import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createApp } from "../../../app";
import type { AppBindings } from "../../../types";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let projectId: string;

const previousAgentsEnv = process.env.PSTDIO_AGENTS;
const previousHomeEnv = process.env.HOME;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-ws-diff-test-"));
  process.env.PSTDIO_AGENTS = "fake";
  const testHome = join(tempRoot, "home");
  mkdirSync(testHome, { recursive: true });
  process.env.HOME = testHome;
  ({ app } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
  }));

  const res = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "diff-test-project" }),
  });
  const project = await res.json();
  projectId = project.id;
});

afterAll(() => {
  if (previousAgentsEnv === undefined) {
    delete process.env.PSTDIO_AGENTS;
  } else {
    process.env.PSTDIO_AGENTS = previousAgentsEnv;
  }
  if (previousHomeEnv === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previousHomeEnv;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

const createGitRepo = (name: string) => {
  const repoRoot = join(tempRoot, name);
  mkdirSync(repoRoot, { recursive: true });
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "# test\n");
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.claude/\n");
  execSync("git add README.md .gitignore", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const createWorkspaceWithDiff = async (repoName: string) => {
  const repoRoot = createGitRepo(repoName);

  const repoRes = await app.request(`/v1/projects/${projectId}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: repoName, path: repoRoot }),
  });
  const repo = await repoRes.json();

  const ticketRes = await app.request("/v1/tickets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: `# ${repoName} ticket` }),
  });
  const ticket = await ticketRes.json();

  const attemptRes = await app.request(`/v1/tickets/${ticket.id}/attempts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      repo_id: repo.id,
      mode: "worktree",
      start_session: false,
    }),
  });
  const attempt = await attemptRes.json();
  return { workspace: attempt.workspace, repoRoot };
};

describe("GET /v1/workspaces/:id/diff", () => {
  test("returns 404 for non-existent workspace", async () => {
    const res = await app.request("/v1/workspaces/non-existent/diff");
    expect(res.status).toBe(404);
  });

  test("current mode (default) — returns empty diff when no uncommitted changes", async () => {
    const { workspace } = await createWorkspaceWithDiff("diff-current-clean");

    // Commit a change — should NOT appear in current mode
    writeFileSync(join(workspace.worktree_path, "committed.txt"), "committed\n");
    execSync("git add committed.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
    execSync('git commit -m "add file"', { cwd: workspace.worktree_path, stdio: "pipe" });

    const res = await app.request(`/v1/workspaces/${workspace.id}/diff`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.workspace_id).toBe(workspace.id);
    expect(body.files).toEqual([]);
    expect(body.totals.file_count).toBe(0);
  });

  test("current mode — shows only uncommitted changes", async () => {
    const { workspace } = await createWorkspaceWithDiff("diff-current-dirty");

    // Commit a change
    writeFileSync(join(workspace.worktree_path, "committed.txt"), "committed\n");
    execSync("git add committed.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
    execSync('git commit -m "add file"', { cwd: workspace.worktree_path, stdio: "pipe" });

    // Add uncommitted file
    writeFileSync(join(workspace.worktree_path, "dirty.txt"), "dirty\n");

    const res = await app.request(`/v1/workspaces/${workspace.id}/diff`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.files.length).toBe(1);
    expect(body.files[0].filePath).toBe("dirty.txt");
  });

  test("fork_point mode — returns all changes since branch diverged", async () => {
    const { workspace } = await createWorkspaceWithDiff("diff-fork-point");

    writeFileSync(join(workspace.worktree_path, "feature.txt"), "feature\n");
    execSync("git add feature.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
    execSync('git commit -m "add feature"', { cwd: workspace.worktree_path, stdio: "pipe" });

    const res = await app.request(`/v1/workspaces/${workspace.id}/diff?mode=fork_point`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const featureFile = body.files.find((f: { filePath: string }) => f.filePath === "feature.txt");
    expect(featureFile).toBeDefined();
    expect(featureFile.change).toBe("added");
    expect(featureFile.newContent).toBe("feature\n");
  });

  test("fork_point mode keeps diff after fast-forward merge", async () => {
    const { workspace, repoRoot } = await createWorkspaceWithDiff("diff-fork-point-fast-forward");

    writeFileSync(join(workspace.worktree_path, "feature.txt"), "feature\n");
    execSync("git add feature.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
    execSync('git commit -m "add feature"', { cwd: workspace.worktree_path, stdio: "pipe" });

    const workspaceBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: workspace.worktree_path,
      stdio: "pipe",
    })
      .toString()
      .trim();
    const defaultBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoRoot, stdio: "pipe" })
      .toString()
      .trim();

    rmSync(join(repoRoot, ".pstdio"), { recursive: true, force: true });
    execSync(`git checkout ${defaultBranch}`, { cwd: repoRoot, stdio: "pipe" });
    execSync(`git merge --ff-only ${workspaceBranch}`, { cwd: repoRoot, stdio: "pipe" });

    const res = await app.request(`/v1/workspaces/${workspace.id}/diff?mode=fork_point`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const featureFile = body.files.find((f: { filePath: string }) => f.filePath === "feature.txt");
    expect(featureFile).toBeDefined();
    expect(featureFile.change).toBe("added");
    expect(featureFile.newContent).toBe("feature\n");
  });
});
