import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string, agentId = "opencode") => {
  await page.addInitScript(
    ({ currentProjectId, currentAgentId }: { currentProjectId: string; currentAgentId: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", currentAgentId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${currentProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: currentAgentId,
            lastSelectedModels: [],
            lastSelectedRepo: "",
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { currentProjectId: projectId, currentAgentId: agentId },
  );
};

const readSyncInitEvent = async () => {
  const controller = new AbortController();
  const response = await fetch(`${apiBase}/v1/sync/stream`, { signal: controller.signal });
  expect(response.ok).toBe(true);
  expect(response.body).not.toBeNull();
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        const event = lines.find((line) => line.startsWith("event: "))?.slice(7);
        const data = lines.find((line) => line.startsWith("data: "))?.slice(6);
        if (event === "init" && data) {
          return JSON.parse(data) as {
            tables: Record<string, Array<{ id: string; [key: string]: unknown }>>;
            seq: number;
          };
        }
      }
    }
  } finally {
    controller.abort();
  }

  throw new Error("Failed to read sync init event.");
};

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-ws-diff-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "workspace diff e2e\n");
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.claude/\n");
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
  const res = await request.post(`${apiBase}/v1/tickets`, {
    data: { project_id: projectId, content },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; shorthand: string };
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
  ticketId: string,
  repoId: string,
) => {
  const res = await request.post(`${apiBase}/v1/tickets/${ticketId}/attempts`, {
    data: { repo_id: repoId, mode: "worktree", start_session: false },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as AttemptResponse;
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
    const attempt = await createAttemptViaApi(request, ticket.id, repo.id);

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
    const attempt = await createAttemptViaApi(request, ticket.id, repo.id);

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
    const attempt = await createAttemptViaApi(request, ticket.id, repo.id);

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
    const attempt = await createAttemptViaApi(request, ticket.id, repo.id);

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
    const attempt = await createAttemptViaApi(request, ticket.id, repo.id);

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

  test("checks tab shows workspace artifacts without ticket_files links", async ({ page, request }) => {
    const repoRoot = createGitRepo();
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, projectId, "artifact-repo", repoRoot);
    const ticket = await createTicketViaApi(request, projectId, "# Artifact workspace test");
    const attempt = await createAttemptViaApi(request, ticket.id, repo.id);
    const syncInit = await readSyncInitEvent();
    const timestamp = "2026-04-12T00:00:00.000Z";
    const artifactFileId = "artifact-file-1";

    await page.route("**/v1/sync/stream**", async (route) => {
      const payload = {
        ...syncInit,
        tables: {
          ...syncInit.tables,
          files: [
            ...(syncInit.tables.files ?? []),
            {
              id: artifactFileId,
              project_id: projectId,
              file_name: "validation.log",
              file_kind: "artifact",
              storage_path: `/tmp/${artifactFileId}`,
              mime_type: "text/plain",
              size_bytes: 22,
              hash: null,
              created_at: timestamp,
              updated_at: timestamp,
            },
          ],
          workspace_artifacts: [
            ...(syncInit.tables.workspace_artifacts ?? []),
            {
              id: "artifact-row-1",
              ticket_id: ticket.id,
              file_id: artifactFileId,
              file_name: "validation.log",
              file_kind: "artifact",
              relative_path: `artifacts/${ticket.shorthand}/validation.log`,
              mime_type: "text/plain",
              size_bytes: 22,
              created_at: timestamp,
            },
          ],
        },
      };

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `event: init\ndata: ${JSON.stringify(payload)}\n\n`,
      });
    });
    await page.route(`**/v1/tickets/${ticket.id}/files/${artifactFileId}/content`, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "validation output\nall good" });
    });

    await bypassOnboarding(page, projectId);
    await page.goto(
      `/projects/${projectId}/tickets/${ticket.shorthand}/workspaces/${attempt.workspace.workspace_shorthand}`,
    );
    await page.getByTestId("workspace-tab-checks").click();

    await expect(page.getByText(`artifacts/${ticket.shorthand}/validation`)).toBeVisible();
    await expect(page.getByText("validation output")).toBeVisible();
    await expect(page.getByTestId("checks-panel-empty")).toHaveCount(0);
  });
});
