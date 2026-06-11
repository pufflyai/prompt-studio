import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const requiresOpencode = process.env.E2E_AGENTS === "opencode";
const selectedModel = "opencode/big-pickle";

type ConversationMessage = {
  role: string;
  modelId?: string;
  providerId?: string;
  parts: Array<{ type: string; text?: string }>;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const createGitRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-opencode-follow-up-"));
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  writeFileSync(join(repoRoot, "README.md"), "opencode follow-up ordering repro\n");
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

const ensureModelAvailable = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/agents/pstdio.harness-open-code.opencode/models`);
  expect(response.ok()).toBe(true);

  const models = (await response.json()) as Array<{ id: string }>;
  expect(models.some((model) => model.id === selectedModel)).toBe(true);
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
  await page.addInitScript(
    ({ projectId, repoId, branch, model }: { projectId: string; repoId: string; branch: string; model: string }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.harness-open-code.opencode");
      localStorage.setItem(
        `pstdio-project-settings/projects/${projectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.harness-open-code.opencode",
            lastSelectedModels: [model],
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
    },
    { ...input, model: selectedModel },
  );
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
        const response = await request.get(`${apiBase}/v1/sessions/${sessionId}`);
        expect(response.ok()).toBe(true);
        const session = (await response.json()) as { status: string };
        return session.status;
      },
      { timeout: 120_000, intervals: [250, 500, 1_000, 2_000, 3_000] },
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

const getConversationMessages = async (request: import("@playwright/test").APIRequestContext, sessionId: string) => {
  const response = await request.get(`${apiBase}/v1/sessions/${sessionId}/conversation`);
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    messages: ConversationMessage[];
  };

  return payload.messages;
};

const getMessageText = (message: ConversationMessage) =>
  normalizeWhitespace(
    message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n"),
  );

const expectConversationOrder = (
  messages: ConversationMessage[],
  input: { firstPrompt: string; followUpPrompt: string },
) => {
  const messageTexts = messages.map(getMessageText).filter(Boolean);

  expect(messageTexts).toEqual([input.firstPrompt, "FIRST DONE", input.followUpPrompt, "SECOND DONE"]);
};

test.describe("OpenCode follow-up ordering", () => {
  let projectId: string;
  let repoDir: string;
  let repoId: string;

  test.skip(!requiresOpencode, "Requires E2E_AGENTS=opencode");

  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);
    await ensureModelAvailable(request);

    repoDir = createGitRepo();
    const project = await createProjectViaApi(request, "OpenCode Follow-up Ordering");
    projectId = project.id;
    const repo = await registerRepoViaApi(request, projectId, "opencode-follow-up-ordering-repo", repoDir);
    repoId = repo.id;
  });

  test.afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("keeps the follow-up turn in order before and after refresh", async ({ page, request }, testInfo) => {
    const firstPrompt = "Reply with exactly FIRST DONE and nothing else.";
    const followUpPrompt = "Reply with exactly SECOND DONE and nothing else.";

    await bypassOnboarding(page, { projectId, repoId, branch: "main" });
    await page.goto(`/projects/${projectId}/sessions`);
    await expect(page.locator("button[aria-label='Select model']")).toContainText(selectedModel);

    const createSessionRequestPromise = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/v1/sessions"),
    );
    await submitMessage(page, firstPrompt);
    const createSessionRequest = await createSessionRequestPromise;
    expect(createSessionRequest.postDataJSON()).toMatchObject({
      agent: "pstdio.harness-open-code.opencode",
      model: selectedModel,
      prompt: firstPrompt,
    });
    await page.waitForURL(new RegExp(`/projects/${projectId}/sessions/[^/]+$`));

    const sessionId = extractSessionIdFromUrl(page.url());

    await expect(page.getByText("FIRST DONE").first()).toBeVisible({ timeout: 120_000 });
    await waitForSessionStatus(request, sessionId, "completed");
    await expect(page.getByText("Working...")).toHaveCount(0);

    const followUpRequestPromise = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith(`/v1/sessions/${sessionId}/follow-up`),
    );
    await submitMessage(page, followUpPrompt);
    const followUpRequest = await followUpRequestPromise;
    expect(followUpRequest.postDataJSON()).toMatchObject({
      agent: "pstdio.harness-open-code.opencode",
      model: selectedModel,
      prompt: followUpPrompt,
    });
    await expect(page.getByText("SECOND DONE").first()).toBeVisible({ timeout: 120_000 });
    await waitForSessionStatus(request, sessionId, "completed");
    await expect(page.getByText("Working...")).toHaveCount(0);

    const beforeRefreshBlocks = await getRenderedConversationBlocks(page);
    const beforeRefreshPath = testInfo.outputPath("follow-up-before-refresh.png");
    await page.screenshot({ path: beforeRefreshPath, fullPage: true });
    expectOrderedConversationBlocks(beforeRefreshBlocks, {
      firstPrompt,
      followUpPrompt,
      label: "before refresh",
    });

    await page.reload();
    await expect(page.getByText("SECOND DONE").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Working...")).toHaveCount(0);

    const afterRefreshBlocks = await getRenderedConversationBlocks(page);
    const afterRefreshPath = testInfo.outputPath("follow-up-after-refresh.png");
    await page.screenshot({ path: afterRefreshPath, fullPage: true });
    expectOrderedConversationBlocks(afterRefreshBlocks, {
      firstPrompt,
      followUpPrompt,
      label: "after refresh",
    });

    const conversationMessages = await getConversationMessages(request, sessionId);
    expectConversationOrder(conversationMessages, { firstPrompt, followUpPrompt });
  });
});
