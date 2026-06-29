import { rmSync } from "node:fs";
import { test } from "@playwright/test";
import {
  bypassOnboarding,
  createFollowUpGitRepo,
  createProjectViaApi,
  deleteAllProjects,
  extractSessionIdFromUrl,
  registerRepoViaApi,
  submitMessage,
  waitForRenderedConversationBlock,
  waitForSessionStatus,
} from "./helpers/session-follow-up";

const requiresClaude = process.env.E2E_AGENTS === "claude-code";
const claudeAgentId = "pstdio.harness-claude-code.claude-code";

test.describe("Claude follow-up completion", () => {
  let projectId: string;
  let repoDir: string;
  let repoId: string;

  test.skip(!requiresClaude, "Requires E2E_AGENTS=claude-code");

  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);

    repoDir = createFollowUpGitRepo({
      prefix: "pstdio-e2e-claude-follow-up-completion-",
      readmeContent: "claude follow-up completion repro",
    });
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

    await bypassOnboarding(page, { projectId, repoId, branch: "main", agentId: claudeAgentId });
    await page.goto(`/projects/${projectId}/sessions`);

    await submitMessage(page, firstPrompt);
    await page.waitForURL(new RegExp(`/projects/${projectId}/sessions/[^/]+$`));

    const sessionId = extractSessionIdFromUrl(page.url());

    await waitForRenderedConversationBlock(page, "FIRST DONE");
    await waitForSessionStatus(request, sessionId, "completed");

    await submitMessage(page, followUpPrompt);

    await waitForSessionStatus(request, sessionId, "in_progress", { timeout: 15_000 });
    await waitForSessionStatus(request, sessionId, "completed", { timeout: 60_000 });
    await waitForRenderedConversationBlock(page, "SECOND DONE", { timeout: 60_000 });
  });
});
