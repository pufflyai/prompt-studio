import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createWorktree } from "pstdio-wt";
import type { AppBindings } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import {
  getWorkspaceDiffFileHandler,
  getWorkspaceDiffFileRoute,
  getWorkspaceDiffFilesHandler,
  getWorkspaceDiffFilesRoute,
  getWorkspaceDiffHandler,
  getWorkspaceDiffRoute,
} from "./get-workspace-diff";

let app: OpenAPIHono<AppBindings>;
let tempRoot: string;
let workspaceSetupQueue = Promise.resolve();
let diffTestQueue = Promise.resolve();
const workspaceRecords = new Map<
  string,
  { id: string; branch: string; project_id: string; worktree_path: string | null }
>();
const reposByProject = new Map<string, Array<{ path: string }>>();
const deps = {
  workspaceService: {
    get: async (id: string) => workspaceRecords.get(id) ?? null,
  },
  repoService: {
    listByProject: async (projectId: string) => reposByProject.get(projectId) ?? [],
  },
} as unknown as WorkspacesRouteDeps;

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-ws-diff-test-"));
  app = new OpenAPIHono<AppBindings>();
  app.openapi(getWorkspaceDiffRoute, getWorkspaceDiffHandler(deps));
  app.openapi(getWorkspaceDiffFilesRoute, getWorkspaceDiffFilesHandler(deps));
  app.openapi(getWorkspaceDiffFileRoute, getWorkspaceDiffFileHandler(deps));
});

afterAll(() => {
  workspaceRecords.clear();
  reposByProject.clear();
  rmSync(tempRoot, { recursive: true, force: true });
});

const createGitRepo = (name: string) => {
  const repoRoot = join(tempRoot, name);
  mkdirSync(repoRoot, { recursive: true });
  execSync("git init", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "# test\n");
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.agents/\n.claude/\n");
  execSync("git add README.md .gitignore", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });

  return repoRoot;
};

const createWorkspaceWithDiff = async (repoName: string) => {
  const setup = workspaceSetupQueue.then(async () => {
    const repoRoot = createGitRepo(repoName);
    const workspaceShorthand = repoName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const branch = `workspace/${workspaceShorthand}`;
    const worktreePath = join(tempRoot, "worktrees", workspaceShorthand);
    const workspace = { id: randomUUID(), branch, project_id: randomUUID(), worktree_path: worktreePath };

    mkdirSync(join(tempRoot, "worktrees"), { recursive: true });
    await createWorktree({ repoRoot, branch, path: worktreePath, base: "HEAD" });

    workspaceRecords.set(workspace.id, workspace);
    return { workspace, repoRoot };
  });

  workspaceSetupQueue = setup.then(
    () => undefined,
    () => undefined,
  );
  return setup;
};

const runDiffTest = async (testBody: () => Promise<void>) => {
  const run = diffTestQueue.then(testBody, testBody);
  diffTestQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

type DiffFile = {
  filePath: string;
  change?: string;
  oldContent?: string;
  newContent?: string;
  additions?: number;
};

type DiffSummary = {
  workspace_id: string;
  files: DiffFile[];
  totals: {
    file_count: number;
    additions: number;
  };
};

const asDiffSummary = (body: unknown) => body as DiffSummary;
const asDiffFile = (body: unknown) => body as DiffFile;

const readJsonResponse = async (res: Response) => ({ status: res.status, body: await res.json() });

const filesOf = (body: unknown) => (body as { files?: Array<{ filePath: string }> }).files ?? [];

const waitForJsonResponse = async (
  request: () => Response | Promise<Response>,
  isReady: (response: { status: number; body: unknown }) => boolean,
) => {
  let lastResponse: { status: number; body: unknown } | null = null;

  for (let attempt = 0; attempt < 30; attempt++) {
    lastResponse = await readJsonResponse(await request());
    if (isReady(lastResponse)) return lastResponse;
    await Bun.sleep(50);
  }

  if (!lastResponse) throw new Error("No response received");
  return lastResponse;
};

const readCurrentBranch = async (cwd: string) => {
  for (let attempt = 0; attempt < 30; attempt++) {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd, stdio: "pipe" }).toString().trim();
    if (branch) return branch;
    await Bun.sleep(50);
  }

  return execSync("git rev-parse --abbrev-ref HEAD", { cwd, stdio: "pipe" }).toString().trim();
};

describe("GET /workspaces/:id/diff", () => {
  test("returns 404 for non-existent workspace", () =>
    runDiffTest(async () => {
      const res = await app.request("/workspaces/non-existent/diff");
      expect(res.status).toBe(404);
    }));

  test("current mode (default) — returns empty diff when no uncommitted changes", () =>
    runDiffTest(async () => {
      const { workspace } = await createWorkspaceWithDiff("diff-current-clean");

      // Commit a change — should NOT appear in current mode
      writeFileSync(join(workspace.worktree_path, "committed.txt"), "committed\n");
      execSync("git add committed.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
      execSync('git commit -m "add file"', { cwd: workspace.worktree_path, stdio: "pipe" });

      const res = await app.request(`/workspaces/${workspace.id}/diff`);
      expect(res.status).toBe(200);

      const body = asDiffSummary(await res.json());
      expect(body.workspace_id).toBe(workspace.id);
      expect(body.files).toEqual([]);
      expect(body.totals.file_count).toBe(0);
    }));

  test("current mode — shows only uncommitted changes", () =>
    runDiffTest(async () => {
      const { workspace } = await createWorkspaceWithDiff("diff-current-dirty");

      // Commit a change
      writeFileSync(join(workspace.worktree_path, "committed.txt"), "committed\n");
      execSync("git add committed.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
      execSync('git commit -m "add file"', { cwd: workspace.worktree_path, stdio: "pipe" });

      // Add uncommitted file
      writeFileSync(join(workspace.worktree_path, "dirty.txt"), "dirty\n");

      const { status, body } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff`),
        (response) => response.status === 200 && filesOf(response.body).some((file) => file.filePath === "dirty.txt"),
      );
      expect(status).toBe(200);

      const diffBody = asDiffSummary(body);
      expect(diffBody.files.length).toBe(1);
      expect(diffBody.files[0].filePath).toBe("dirty.txt");
    }));

  test("current mode resolves a default workspace through its linked repository", () =>
    runDiffTest(async () => {
      const repoRoot = createGitRepo("diff-current-default");
      const workspace = {
        id: randomUUID(),
        branch: "main",
        project_id: randomUUID(),
        worktree_path: null,
      };
      workspaceRecords.set(workspace.id, workspace);
      reposByProject.set(workspace.project_id, [{ path: repoRoot }]);
      writeFileSync(join(repoRoot, "README.md"), "# changed default workspace\n");

      const response = await app.request(`/workspaces/${workspace.id}/diff-files?mode=current`);

      expect(response.status).toBe(200);
      const body = asDiffSummary(await response.json());
      expect(body.files).toEqual([expect.objectContaining({ filePath: "README.md", change: "modified" })]);
    }));

  test("fork_point mode — returns all changes since branch diverged", () =>
    runDiffTest(async () => {
      const { workspace } = await createWorkspaceWithDiff("diff-fork-point");

      writeFileSync(join(workspace.worktree_path, "feature.txt"), "feature\n");
      execSync("git add feature.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
      execSync('git commit -m "add feature"', { cwd: workspace.worktree_path, stdio: "pipe" });

      const { status, body } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff?mode=fork_point`),
        (response) => response.status === 200 && filesOf(response.body).some((file) => file.filePath === "feature.txt"),
      );
      expect(status).toBe(200);

      const diffBody = asDiffSummary(body);
      const featureFile = diffBody.files.find((f) => f.filePath === "feature.txt");
      expect(featureFile).toBeDefined();
      expect(featureFile?.change).toBe("added");
      expect(featureFile?.newContent).toBe("feature\n");
    }));

  test("diff-files omits file bodies from the initial workspace diff payload", () =>
    runDiffTest(async () => {
      const { workspace } = await createWorkspaceWithDiff("diff-files-summary");

      writeFileSync(join(workspace.worktree_path, "feature.txt"), "feature\n");
      execSync("git add feature.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
      execSync('git commit -m "add feature"', { cwd: workspace.worktree_path, stdio: "pipe" });

      const { status, body } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff-files?mode=fork_point`),
        (response) => response.status === 200 && filesOf(response.body).some((file) => file.filePath === "feature.txt"),
      );
      expect(status).toBe(200);

      const diffBody = asDiffSummary(body);
      const featureFile = diffBody.files.find((f) => f.filePath === "feature.txt");
      expect(featureFile).toBeDefined();
      expect(featureFile?.oldContent).toBeUndefined();
      expect(featureFile?.newContent).toBeUndefined();
    }));

  test("diff-file returns one file body on demand", () =>
    runDiffTest(async () => {
      const { workspace } = await createWorkspaceWithDiff("diff-file-body");

      writeFileSync(join(workspace.worktree_path, "feature.txt"), "feature\n");
      execSync("git add feature.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
      execSync('git commit -m "add feature"', { cwd: workspace.worktree_path, stdio: "pipe" });

      const { status, body } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff-file?mode=fork_point&path=feature.txt`),
        (response) => response.status === 200,
      );
      expect(status).toBe(200);

      const fileBody = asDiffFile(body);
      expect(fileBody.filePath).toBe("feature.txt");
      expect(fileBody.newContent).toBe("feature\n");
    }));

  test("diff-files and diff-file count untracked added file lines", () =>
    runDiffTest(async () => {
      const { workspace } = await createWorkspaceWithDiff("diff-untracked-added-counts");

      writeFileSync(join(workspace.worktree_path, "untracked.txt"), "one\ntwo\nthree\n");

      const { status: summaryStatus, body: summary } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff-files?mode=fork_point`),
        (response) =>
          response.status === 200 &&
          filesOf(response.body).some((file) => file.filePath === "untracked.txt") &&
          (response.body as { totals?: { additions?: number } }).totals?.additions === 3,
      );
      expect(summaryStatus).toBe(200);

      const summaryBody = asDiffSummary(summary);
      const summaryFile = summaryBody.files.find((f) => f.filePath === "untracked.txt");
      expect(summaryFile).toBeDefined();
      expect(summaryFile?.additions).toBe(3);
      expect(summaryBody.totals.additions).toBe(3);

      const { status: fileStatus, body: file } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff-file?mode=fork_point&path=untracked.txt`),
        (response) => response.status === 200,
      );
      expect(fileStatus).toBe(200);

      const fileBody = asDiffFile(file);
      expect(fileBody.additions).toBe(3);
      expect(fileBody.newContent).toBe("one\ntwo\nthree\n");
    }));

  test("fork_point mode keeps diff after fast-forward merge", () =>
    runDiffTest(async () => {
      const { workspace, repoRoot } = await createWorkspaceWithDiff("diff-fork-point-fast-forward");

      writeFileSync(join(workspace.worktree_path, "feature.txt"), "feature\n");
      execSync("git add feature.txt", { cwd: workspace.worktree_path, stdio: "pipe" });
      execSync('git commit -m "add feature"', { cwd: workspace.worktree_path, stdio: "pipe" });

      const workspaceBranch = await readCurrentBranch(workspace.worktree_path);
      const defaultBranch = await readCurrentBranch(repoRoot);

      rmSync(join(repoRoot, ".pstdio"), { recursive: true, force: true });
      execSync(`git checkout ${defaultBranch}`, { cwd: repoRoot, stdio: "pipe" });
      execSync(`git merge --ff-only ${workspaceBranch}`, { cwd: repoRoot, stdio: "pipe" });

      const { status, body } = await waitForJsonResponse(
        () => app.request(`/workspaces/${workspace.id}/diff?mode=fork_point`),
        (response) => response.status === 200 && filesOf(response.body).some((file) => file.filePath === "feature.txt"),
      );
      expect(status).toBe(200);

      const diffBody = asDiffSummary(body);
      const featureFile = diffBody.files.find((f) => f.filePath === "feature.txt");
      expect(featureFile).toBeDefined();
      expect(featureFile?.change).toBe("added");
      expect(featureFile?.newContent).toBe("feature\n");
    }));
});
