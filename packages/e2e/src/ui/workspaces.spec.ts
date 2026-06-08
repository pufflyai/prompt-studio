import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createPlannerAttempt, createPlannerTicket } from "../helpers/planner-api";
import {
  createLargeCommittedDiff,
  readDiffViewportScrollTop,
  readHeaderOffsetFromViewport,
  readRenderedDiffCardGaps,
  readSelectedCardOffsetFromHeader,
  scrollTreeListToBottom,
  scrollTreeListToTop,
} from "./helpers/large-diff-navigation";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-ws-diff-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "workspace diff e2e\n");
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.agents/\n.claude/\n");
  execSync("git add README.md .gitignore", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    await request.delete(`${apiBase}/v1/projects/${p.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const registerRepoViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
  path: string,
) => {
  const res = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name, path },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const createTicketViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  content: string,
) => {
  return createPlannerTicket(request, apiBase, projectId, { content });
};

type Workspace = {
  id: string;
  workspace_shorthand: string;
  worktree_path: string;
  branch: string | null;
};

type AttemptResponse = {
  workspace: Workspace;
};

const createAttemptViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  ticketId: string,
  repoId: string,
) => {
  return createPlannerAttempt(request, apiBase, projectId, {
    ticketId,
    repoId,
    mode: "worktree",
    startSession: false,
  }) as Promise<AttemptResponse>;
};

type DiffResponse = {
  workspace_id: string;
  files: Array<{ filePath: string; change: string; additions: number; deletions: number }>;
  totals: { additions: number; deletions: number; file_count: number };
};

test.describe("Workspace diff", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Workspace Diff Test");
    projectId = project.id;
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
  });

  test("current mode (default) — returns empty diff when no uncommitted changes", async ({ request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "clean-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Clean workspace test");
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);

    // Commit a change — should NOT appear in current mode (only uncommitted)
    const wtPath = attempt.workspace.worktree_path;
    writeFileSync(join(wtPath, "committed.ts"), "export const x = 1;\n");
    execSync("git add committed.ts", { cwd: wtPath, stdio: "pipe" });
    execSync('git commit -m "add committed"', { cwd: wtPath, stdio: "pipe" });

    const res = await request.get(`${apiBase}/v1/workspaces/${attempt.workspace.id}/diff`);
    expect(res.ok()).toBe(true);
    const diff = (await res.json()) as DiffResponse;

    expect(diff.workspace_id).toBe(attempt.workspace.id);
    expect(diff.files).toEqual([]);
    expect(diff.totals.file_count).toBe(0);
  });

  test("current mode — shows only uncommitted changes", async ({ request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "current-dirty-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Current mode dirty test");
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);

    const wtPath = attempt.workspace.worktree_path;

    // Commit a change
    writeFileSync(join(wtPath, "committed.ts"), "export const x = 1;\n");
    execSync("git add .", { cwd: wtPath, stdio: "pipe" });
    execSync('git commit -m "add committed"', { cwd: wtPath, stdio: "pipe" });

    // Add uncommitted file
    writeFileSync(join(wtPath, "wip.txt"), "work in progress\n");

    const res = await request.get(`${apiBase}/v1/workspaces/${attempt.workspace.id}/diff`);
    expect(res.ok()).toBe(true);
    const diff = (await res.json()) as DiffResponse;

    expect(diff.files.length).toBe(1);
    expect(diff.files[0].filePath).toBe("wip.txt");
  });

  test("fork_point mode — returns all changes since branch diverged", async ({ request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "fork-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Fork point test");
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);

    const wtPath = attempt.workspace.worktree_path;
    writeFileSync(join(wtPath, "feature.ts"), 'export const greet = () => "hello";\n');
    execSync("git add feature.ts", { cwd: wtPath, stdio: "pipe" });
    execSync('git commit -m "add feature"', { cwd: wtPath, stdio: "pipe" });

    const res = await request.get(`${apiBase}/v1/workspaces/${attempt.workspace.id}/diff?mode=fork_point`);
    expect(res.ok()).toBe(true);
    const diff = (await res.json()) as DiffResponse;

    const featureFile = diff.files.find((f) => f.filePath === "feature.ts");
    expect(featureFile).toBeDefined();
    expect(featureFile!.change).toBe("added");
    expect(featureFile!.additions).toBe(1);
  });

  test("returns 404 for non-existent workspace", async ({ request }) => {
    const res = await request.get(`${apiBase}/v1/workspaces/non-existent-id/diff`);
    expect(res.status()).toBe(404);
  });

  test("fork_point mode keeps diff after squash merge when workspace remains", async ({ request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "ui-diff-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Merge diff retention test");
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);

    // Commit a file on the workspace branch
    const wtPath = attempt.workspace.worktree_path;
    writeFileSync(join(wtPath, "component.tsx"), "export const App = () => <div>Hello</div>;\n");
    execSync("git add component.tsx", { cwd: wtPath, stdio: "pipe" });
    execSync('git commit -m "add component"', { cwd: wtPath, stdio: "pipe" });

    // Squash-merge workspace branch into main while keeping the workspace branch alive
    const workspaceBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: wtPath, stdio: "pipe" })
      .toString()
      .trim();
    execSync("git checkout main", { cwd: repoRoot, stdio: "pipe" });
    rmSync(join(repoRoot, ".pstdio"), { recursive: true, force: true });
    execSync(`git merge --squash ${workspaceBranch}`, { cwd: repoRoot, stdio: "pipe" });
    execSync('git commit -m "squash merge workspace changes"', { cwd: repoRoot, stdio: "pipe" });

    const diffRes = await request.get(`${apiBase}/v1/workspaces/${attempt.workspace.id}/diff?mode=fork_point`);
    expect(diffRes.ok()).toBe(true);
    const diff = (await diffRes.json()) as DiffResponse;

    const componentFile = diff.files.find((file) => file.filePath === "component.tsx");
    expect(componentFile).toBeDefined();
    expect(componentFile!.change).toBe("added");
  });

  test("fork_point mode keeps diff after fast-forward merge when workspace remains", async ({ request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "ui-diff-ff-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Fast-forward merge diff retention test");
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);

    const wtPath = attempt.workspace.worktree_path;
    writeFileSync(join(wtPath, "widget.tsx"), "export const Widget = () => <div>Widget</div>;\n");
    execSync("git add widget.tsx", { cwd: wtPath, stdio: "pipe" });
    execSync('git commit -m "add widget"', { cwd: wtPath, stdio: "pipe" });

    const workspaceBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: wtPath, stdio: "pipe" })
      .toString()
      .trim();
    const defaultBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: repoRoot, stdio: "pipe" })
      .toString()
      .trim();

    rmSync(join(repoRoot, ".pstdio"), { recursive: true, force: true });
    execSync(`git checkout ${defaultBranch}`, { cwd: repoRoot, stdio: "pipe" });
    execSync(`git merge --ff-only ${workspaceBranch}`, { cwd: repoRoot, stdio: "pipe" });

    const diffRes = await request.get(`${apiBase}/v1/workspaces/${attempt.workspace.id}/diff?mode=fork_point`);
    expect(diffRes.ok()).toBe(true);
    const diff = (await diffRes.json()) as DiffResponse;

    const widgetFile = diff.files.find((file) => file.filePath === "widget.tsx");
    expect(widgetFile).toBeDefined();
    expect(widgetFile!.change).toBe("added");
  });

  test("clicking a far-down changed file top-aligns that diff in the dashboard", async ({ page, request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "large-diff-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Large diff navigation test");
    const attempt = await createAttemptViaApi(request, projectId, ticket.id, repo.id);
    const targetPath = "file-126.txt";

    createLargeCommittedDiff(attempt.workspace.worktree_path, 126);

    await page.goto(
      `/projects/${projectId}/tickets/${ticket.shorthand}/workspaces/${attempt.workspace.workspace_shorthand}`,
    );

    const diffViewer = page.getByTestId("diff-viewer");
    await expect(diffViewer).toBeVisible();
    await expect(diffViewer.getByRole("option", { name: ".agents" })).toBeVisible();

    const changedFilesTree = diffViewer.getByRole("listbox").first();
    await scrollTreeListToBottom(changedFilesTree);

    const targetFileOption = diffViewer.getByRole("option", { name: new RegExp(targetPath) });
    await expect(targetFileOption).toBeVisible();
    await targetFileOption.click();

    await expect(targetFileOption).toHaveAttribute("aria-selected", "true");

    const targetHeader = diffViewer.getByTestId("diff-card-header").filter({ hasText: targetPath });
    await expect(targetHeader).toBeVisible();
    await expect(targetHeader.getByRole("button", { name: "Collapse" })).toBeVisible();

    await expect.poll(() => readSelectedCardOffsetFromHeader(targetHeader), { timeout: 5_000 }).toBeLessThan(72);

    const cardOffset = await readSelectedCardOffsetFromHeader(targetHeader);
    expect(cardOffset).toBeGreaterThanOrEqual(0);

    const scrollStart = await readDiffViewportScrollTop(diffViewer);
    const targetHeaderBox = await targetHeader.boundingBox();
    expect(targetHeaderBox).not.toBeNull();
    await page.mouse.move(targetHeaderBox!.x + 20, targetHeaderBox!.y + 20);
    for (let index = 0; index < 4; index += 1) {
      await page.mouse.wheel(0, -900);
    }
    await page.waitForTimeout(300);
    expect(await readDiffViewportScrollTop(diffViewer)).toBeLessThan(scrollStart - 1_000);

    const nestedTargetPath = ".agents/skills/create-pstdio-extension/references/scope.md";
    await scrollTreeListToTop(changedFilesTree);
    const nestedTargetOption = diffViewer.locator(`[data-tree-list-focus-id="file:${nestedTargetPath}"]`);
    await expect(nestedTargetOption).toBeVisible();
    await nestedTargetOption.click();
    await expect(nestedTargetOption).toHaveAttribute("aria-selected", "true");

    const nestedTargetHeader = diffViewer.getByTestId("diff-card-header").filter({ hasText: nestedTargetPath });
    await expect(nestedTargetHeader).toBeVisible({ timeout: 300 });
    await expect.poll(() => readSelectedCardOffsetFromHeader(nestedTargetHeader), { timeout: 5_000 }).toBeLessThan(72);

    const nestedHeaderBox = await nestedTargetHeader.boundingBox();
    expect(nestedHeaderBox).not.toBeNull();
    await page.mouse.move(nestedHeaderBox!.x + 20, nestedHeaderBox!.y + 20);
    await page.mouse.wheel(0, 350);
    await expect.poll(() => readHeaderOffsetFromViewport(nestedTargetHeader), { timeout: 2_000 }).toBeLessThan(72);
    expect(await readHeaderOffsetFromViewport(nestedTargetHeader)).toBeGreaterThanOrEqual(0);

    const renderedGaps = await readRenderedDiffCardGaps(diffViewer);
    expect(renderedGaps.length).toBeGreaterThan(0);
    expect(Math.max(...renderedGaps)).toBeLessThanOrEqual(12);
  });
});
