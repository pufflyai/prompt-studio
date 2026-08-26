import { rmSync } from "node:fs";
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  apiBase,
  bypassOnboarding,
  createFollowUpGitRepo,
  createProjectViaApi,
  deleteAllProjects,
  expectOrderedConversationBlocks,
  getRenderedConversationBlocks,
  openNewSessionPanel,
  openRecentSession,
  registerRepoViaApi,
  setProjectAgentDefaults,
  submitInitialMessage,
  submitMessage,
  waitForRenderedConversationBlock,
  waitForSessionStatus,
} from "./helpers/session-follow-up";

const requiresOpencode = process.env.E2E_AGENTS === "opencode";
const opencodeAgentId = "pstdio.harness-open-code.harness.opencode";
const selectedModel = "opencode/big-pickle";
const opencodeStatusTimeout = 120_000;

type ConversationMessage = {
  role: string;
  modelId?: string;
  providerId?: string;
  parts: Array<{ type: string; text?: string }>;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const ensureModelAvailable = async (request: APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/agents/${opencodeAgentId}/models`);
  expect(response.ok()).toBe(true);

  const models = (await response.json()) as Array<{ id: string }>;
  expect(models.some((model) => model.id === selectedModel)).toBe(true);
};

const getConversationMessages = async (request: APIRequestContext, sessionId: string) => {
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

    repoDir = createFollowUpGitRepo({
      prefix: "pstdio-e2e-opencode-follow-up-",
      readmeContent: "opencode follow-up ordering repro",
    });
    const project = await createProjectViaApi(request, "OpenCode Follow-up Ordering");
    projectId = project.id;
    await setProjectAgentDefaults(request, projectId, opencodeAgentId, selectedModel);
    const repo = await registerRepoViaApi(request, projectId, "opencode-follow-up-ordering-repo", repoDir);
    repoId = repo.id;
  });

  test.afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("keeps the follow-up turn in order before and after refresh", async ({ page, request }, testInfo) => {
    const firstPrompt = "Reply with exactly FIRST DONE and nothing else.";
    const followUpPrompt = "Reply with exactly SECOND DONE and nothing else.";

    await bypassOnboarding(page, {
      projectId,
      repoId,
      branch: "main",
      agentId: opencodeAgentId,
      models: [selectedModel],
    });
    await openNewSessionPanel(page, projectId);
    await expect(page.locator("button[aria-label='Select model']")).toContainText(selectedModel);

    const initialMessage = await submitInitialMessage(page, firstPrompt);
    expect(initialMessage.request.postDataJSON()).toMatchObject({
      agent: opencodeAgentId,
      model: selectedModel,
      prompt: firstPrompt,
    });
    const sessionId = initialMessage.sessionId;

    await waitForRenderedConversationBlock(page, "FIRST DONE", { timeout: opencodeStatusTimeout });
    await waitForSessionStatus(request, sessionId, "completed", { timeout: opencodeStatusTimeout });
    await expect(page.getByText("Working...")).toHaveCount(0);

    const followUpRequestPromise = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith(`/v1/sessions/${sessionId}/follow-up`),
    );
    await submitMessage(page, followUpPrompt);
    const followUpRequest = await followUpRequestPromise;
    expect(followUpRequest.postDataJSON()).toMatchObject({
      agent: opencodeAgentId,
      model: selectedModel,
      prompt: followUpPrompt,
    });
    await waitForSessionStatus(request, sessionId, "completed", { timeout: opencodeStatusTimeout });
    await waitForRenderedConversationBlock(page, "SECOND DONE", { timeout: opencodeStatusTimeout });
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
    await openRecentSession(page, firstPrompt);
    await waitForRenderedConversationBlock(page, "SECOND DONE", { timeout: opencodeStatusTimeout });
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
