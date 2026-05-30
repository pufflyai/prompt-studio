import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const requiresClaude = process.env.E2E_AGENTS === "claude-code";

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-claude-follow-up-completion-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "claude follow-up completion repro\n");
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.agents/\n.claude/\n");
  execSync("git add README.md .gitignore", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);

  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) {
    const deletion = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deletion.ok()).toBe(true);
  }
};

const configureClaudeAgent = async (request: import("@playwright/test").APIRequestContext) => {
  const binary = process.env.E2E_CLAUDE_BINARY;
  const response = await request.post(`${apiBase}/v1/agents`, {
    data: binary ? { agent_id: "claude-code", binary } : { agent_id: "claude-code" },
  });
  expect(response.ok()).toBe(true);
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string };
};

const registerRepoViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  name: string,
  path: string,
) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name, path },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string; path: string };
};

const bypassOnboarding = async (
  page: import("@playwright/test").Page,
  input: { projectId: string; repoId: string; branch: string },
) => {
  await page.addInitScript(({ projectId, repoId, branch }: { projectId: string; repoId: string; branch: string }) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "claude-code");
    localStorage.setItem(
      `pstdio-project-settings/projects/${projectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "claude-code",
          lastSelectedModels: [],
          lastSelectedRepo: repoId,
          lastSelectedBranches: [branch],
          sessionModalState: "bubble",
          selectedSessionId: null,
          lastNonSessionsPath: null,
          chatDraftsBySession: {},
        },
        version: 0,
      }),
    );
  }, input);
};

const submitMessage = async (page: import("@playwright/test").Page, text: string) => {
  const contentEditor = page.locator("[data-testid='content-editable'][contenteditable='true']").last();
  await contentEditor.click();
  await contentEditor.fill(text);
  await page.locator("[data-testid='send-message-button']").click();
};

const extractSessionIdFromUrl = (url: string) => {
  const match = url.match(/\/sessions\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Could not extract session id from URL: ${url}`);
  }

  return match[1];
};

const waitForSessionStatus = async (
  request: import("@playwright/test").APIRequestContext,
  sessionId: string,
  status: string,
  timeout = 90_000,
) => {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBase}/v1/sessions/${sessionId}`);
        expect(response.ok()).toBe(true);
        const session = (await response.json()) as { status: string };
        return session.status;
      },
      { timeout, intervals: [250, 500, 1_000, 2_000, 3_000] },
    )
    .toBe(status);
};

const waitForRenderedConversationBlock = async (
  page: import("@playwright/test").Page,
  text: string,
  timeout = 90_000,
) => {
  await expect
    .poll(
      async () => {
        const blocks = await page
          .locator("[role='log'] [role='textbox']")
          .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

        return blocks.map(normalizeWhitespace).some((block) => block === text);
      },
      { timeout, intervals: [250, 500, 1_000, 2_000, 3_000] },
    )
    .toBe(true);
};

test.describe("Claude follow-up completion", () => {
  let projectId: string;
  let repoDir: string;
  let repoId: string;

  test.skip(!requiresClaude, "Requires E2E_AGENTS=claude-code");

  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);
    await configureClaudeAgent(request);

    repoDir = createGitRepo();
    const project = await createProjectViaApi(request, "Claude Follow-up Completion");
    projectId = project.id;
    const repo = await registerRepoViaApi(request, projectId, "claude-follow-up-completion-repo", repoDir);
    repoId = repo.id;
  });

  test.afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("completes a follow-up instead of staying stuck in working", async ({ page, request }) => {
    const firstPrompt = "Reply with exactly FIRST DONE and nothing else.";
    const followUpPrompt = "Reply with exactly SECOND DONE and nothing else.";

    await bypassOnboarding(page, { projectId, repoId, branch: "main" });
    await page.goto(`/projects/${projectId}/sessions`);

    await submitMessage(page, firstPrompt);
    await page.waitForURL(new RegExp(`/projects/${projectId}/sessions/[^/]+$`));

    const sessionId = extractSessionIdFromUrl(page.url());

    await waitForRenderedConversationBlock(page, "FIRST DONE");
    await waitForSessionStatus(request, sessionId, "completed");

    await submitMessage(page, followUpPrompt);

    await waitForSessionStatus(request, sessionId, "in_progress", 15_000);
    await waitForSessionStatus(request, sessionId, "completed", 60_000);
    await waitForRenderedConversationBlock(page, "SECOND DONE", 60_000);
  });
});
