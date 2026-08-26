import { rmSync } from "node:fs";
import { test } from "@playwright/test";
import {
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

const requiresClaude = process.env.E2E_AGENTS === "claude-code";
const claudeAgentId = "pstdio.harness-claude-code.harness.claude-code";

test.describe("Claude follow-up ordering repro", () => {
  let projectId: string;
  let repoDir: string;
  let repoId: string;

  test.skip(!requiresClaude, "Requires E2E_AGENTS=claude-code");

  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);

    repoDir = createFollowUpGitRepo({
      prefix: "pstdio-e2e-claude-follow-up-",
      readmeContent: "claude follow-up ordering repro",
    });
    const project = await createProjectViaApi(request, "Claude Follow-up Ordering Repro");
    projectId = project.id;
    await setProjectAgentDefaults(request, projectId, claudeAgentId);
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

    await bypassOnboarding(page, { projectId, repoId, branch: "main", agentId: claudeAgentId });
    await openNewSessionPanel(page, projectId);
    const { sessionId } = await submitInitialMessage(page, firstPrompt);

    await waitForRenderedConversationBlock(page, "FIRST DONE");
    await waitForSessionStatus(request, sessionId, "completed");

    await submitMessage(page, followUpPrompt);
    await waitForSessionStatus(request, sessionId, "completed");
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
    await openRecentSession(page, firstPrompt);
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
