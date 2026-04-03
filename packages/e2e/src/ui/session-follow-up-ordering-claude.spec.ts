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
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-claude-follow-up-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "claude follow-up ordering repro\n");
  writeFileSync(join(repoRoot, ".gitignore"), ".pstdio/\n.opencode/\n.claude/\n");
  execSync("git add README.md .gitignore", { cwd: repoRoot, stdio: "pipe" });
  execSync('git commit -m "init"', { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);

  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    const del = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(del.ok()).toBe(true);
  }
};

const configureClaudeAgent = async (request: import("@playwright/test").APIRequestContext) => {
  const binary = process.env.E2E_CLAUDE_BINARY;
  const res = await request.post(`${apiBase}/v1/agents`, {
    data: binary ? { agent_id: "claude-code", binary } : { agent_id: "claude-code" },
  });
  expect(res.ok()).toBe(true);
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
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
  return (await res.json()) as { id: string; name: string; path: string };
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
) => {
  await expect
    .poll(
      async () => {
        const res = await request.get(`${apiBase}/v1/sessions/${sessionId}`);
        expect(res.ok()).toBe(true);
        const session = (await res.json()) as { status: string };
        return session.status;
      },
      { timeout: 90_000, intervals: [250, 500, 1_000, 2_000, 3_000] },
    )
    .toBe(status);
};

const getRenderedConversationBlocks = async (page: import("@playwright/test").Page) => {
  const blocks = await page
    .locator("[role='log'] [role='textbox']")
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));

  return blocks.map(normalizeWhitespace).filter(Boolean);
};

const getExactMatchIndices = (blocks: string[], expected: string) =>
  blocks.flatMap((block, index) => (block === expected ? [index] : []));

const expectOrderedConversationBlocks = (
  blocks: string[],
  input: { firstPrompt: string; followUpPrompt: string; label: string },
) => {
  const firstPromptIndices = getExactMatchIndices(blocks, input.firstPrompt);
  const firstResponseIndices = getExactMatchIndices(blocks, "FIRST DONE");
  const followUpPromptIndices = getExactMatchIndices(blocks, input.followUpPrompt);
  const followUpResponseIndices = getExactMatchIndices(blocks, "SECOND DONE");

  expect(firstPromptIndices, `${input.label}: first user prompt should appear exactly once`).toHaveLength(1);
  expect(firstResponseIndices, `${input.label}: first assistant reply should appear exactly once`).toHaveLength(1);
  expect(followUpPromptIndices, `${input.label}: follow-up user prompt should appear exactly once`).toHaveLength(1);
  expect(followUpResponseIndices, `${input.label}: follow-up assistant reply should appear exactly once`).toHaveLength(
    1,
  );

  expect(firstPromptIndices[0]!).toBeLessThan(firstResponseIndices[0]!);
  expect(firstResponseIndices[0]!).toBeLessThan(followUpPromptIndices[0]!);
  expect(followUpPromptIndices[0]!).toBeLessThan(followUpResponseIndices[0]!);
};

const waitForRenderedConversationBlock = async (page: import("@playwright/test").Page, text: string) => {
  await expect
    .poll(
      async () => {
        const blocks = await getRenderedConversationBlocks(page);
        return getExactMatchIndices(blocks, text).length > 0;
      },
      { timeout: 90_000, intervals: [250, 500, 1_000, 2_000, 3_000] },
    )
    .toBe(true);
};

test.describe("Claude follow-up ordering repro", () => {
  let projectId: string;
  let repoDir: string;
  let repoId: string;

  test.skip(!requiresClaude, "Requires E2E_AGENTS=claude-code");

  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);
    await configureClaudeAgent(request);

    repoDir = createGitRepo();
    const project = await createProjectViaApi(request, "Claude Follow-up Ordering Repro");
    projectId = project.id;
    const repo = await registerRepoViaApi(request, projectId, "claude-follow-up-ordering-repo", repoDir);
    repoId = repo.id;
  });

  test.afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("keeps the follow-up user message above the follow-up assistant response", async ({
    page,
    request,
  }, testInfo) => {
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
    await waitForRenderedConversationBlock(page, "SECOND DONE");

    const beforeRefreshBlocks = await getRenderedConversationBlocks(page);
    const beforeRefreshPath = testInfo.outputPath("follow-up-before-refresh.png");
    await page.screenshot({ path: beforeRefreshPath, fullPage: true });
    expectOrderedConversationBlocks(beforeRefreshBlocks, {
      firstPrompt,
      followUpPrompt,
      label: "before refresh",
    });

    await page.reload();
    await waitForRenderedConversationBlock(page, "SECOND DONE");

    const afterRefreshBlocks = await getRenderedConversationBlocks(page);
    const afterRefreshPath = testInfo.outputPath("follow-up-after-refresh.png");
    await page.screenshot({ path: afterRefreshPath, fullPage: true });
    expectOrderedConversationBlocks(afterRefreshBlocks, {
      firstPrompt,
      followUpPrompt,
      label: "after refresh",
    });
  });
});
