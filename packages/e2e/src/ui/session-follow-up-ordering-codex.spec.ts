import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  bypassOnboarding,
  createFollowUpGitRepo,
  createProjectViaApi,
  deleteAllProjects,
  expectConversationLayoutOrder,
  expectOrderedConversationBlocks,
  getRenderedConversationBlocks,
  openNewSessionPanel,
  registerRepoViaApi,
  setProjectAgentDefaults,
  startConversationLayoutRecorder,
  submitInitialMessage,
  submitMessage,
  waitForRenderedConversationBlock,
  waitForSessionStatus,
} from "./helpers/session-follow-up";

const requiresCodex = process.env.E2E_AGENTS === "codex";
const codexAgentId = "pstdio.harness-codex.codex";

test.describe("Codex follow-up ordering", () => {
  let projectId: string;
  let repoDir: string;
  let repoId: string;

  test.skip(!requiresCodex, "Requires E2E_AGENTS=codex");

  test.beforeEach(async ({ request }) => {
    test.setTimeout(180_000);
    await deleteAllProjects(request);

    repoDir = createFollowUpGitRepo({
      prefix: "pstdio-e2e-codex-follow-up-",
      readmeContent: "codex follow-up ordering repro",
    });
    const project = await createProjectViaApi(request, "Codex Follow-up Ordering");
    projectId = project.id;
    await setProjectAgentDefaults(request, projectId, codexAgentId);
    const repo = await registerRepoViaApi(request, projectId, "codex-follow-up-ordering-repo", repoDir);
    repoId = repo.id;
  });

  test.afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  test("keeps the prior response above a live follow-up before refresh", async ({ page, request }) => {
    const initialPrompt = "Write a long poem of at least 80 lines about this project. End with exactly POEM DONE.";
    const firstPrompt = "Reply with exactly FIRST DONE and nothing else.";
    const followUpPrompt = "Inspect README.md with a shell command, then reply with exactly SECOND DONE.";

    await bypassOnboarding(page, { projectId, repoId, branch: "main", agentId: codexAgentId });
    await openNewSessionPanel(page, projectId);
    const { sessionId } = await submitInitialMessage(page, initialPrompt);

    await expect(page.getByText("POEM DONE", { exact: false }).last()).toBeVisible({ timeout: 120_000 });
    await waitForSessionStatus(request, sessionId, "completed", { timeout: 120_000 });

    await submitMessage(page, firstPrompt);

    await waitForRenderedConversationBlock(page, "FIRST DONE");
    await waitForSessionStatus(request, sessionId, "completed");

    const stopRecording = await startConversationLayoutRecorder(page);
    await submitMessage(page, followUpPrompt);
    await waitForSessionStatus(request, sessionId, "in_progress", { timeout: 15_000 });
    await waitForSessionStatus(request, sessionId, "completed", { timeout: 120_000 });
    await waitForRenderedConversationBlock(page, "SECOND DONE", { timeout: 120_000 });
    const liveLayout = await stopRecording();

    expectConversationLayoutOrder(liveLayout, { earlier: "FIRST DONE", later: followUpPrompt });
    const renderedBlocks = await getRenderedConversationBlocks(page);
    expectOrderedConversationBlocks(renderedBlocks, { firstPrompt, followUpPrompt, label: "live before refresh" });
    await expect(page.getByText("Working...")).toHaveCount(0);
  });
});
