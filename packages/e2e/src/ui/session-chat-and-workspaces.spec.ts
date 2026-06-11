import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  createAttemptWithSessionViaApi,
  createGitRepo,
  createTicketViaApi,
  registerRepoViaApi,
} from "./helpers/workspace-session-attempt";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const QUESTION_PROMPT_TRIGGER = "__fake_question_prompt__";

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-lab.fake");
  });
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const createSessionViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  title: string,
) => {
  const res = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      title,
      prompt: title,
      agent: "pstdio.harness-lab.fake",
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);
  const projects = (await res.json()) as { id: string }[];
  for (const p of projects) {
    const del = await request.delete(`${apiBase}/v1/projects/${p.id}`);
    expect(del.ok()).toBe(true);
  }
};

test.describe("Session chat and workspace behavior", () => {
  let projectId: string;
  const repoDirs: string[] = [];

  test.beforeEach(async ({ request }) => {
    test.setTimeout(10_000);
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Sessions Chat Test Project");
    projectId = project.id;
  });

  test.afterEach(() => {
    for (const dir of repoDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    repoDirs.length = 0;
  });

  test("submits a message from the sessions page and creates a session", async ({ page }) => {
    await bypassOnboarding(page);
    const prompt = "Session page new message";

    await page.goto(`/projects/${projectId}/sessions`);

    const contentEditor = page.locator("[data-testid='content-editable']").first();
    await contentEditor.fill(prompt);
    await page.locator("[data-testid='send-message-button']").click();

    await page.waitForURL(new RegExp(`/projects/${projectId}/sessions/[^/]+$`));
    await expect(page.getByText(prompt).first()).toBeVisible();
    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();
  });

  test("shows conversation messages when navigating to a completed session", async ({ page, request }) => {
    await bypassOnboarding(page);
    const prompt = "Hydration test message";

    const session = await createSessionViaApi(request, projectId, prompt);

    await page.waitForTimeout(200);

    await page.goto(`/projects/${projectId}/sessions/${session.id}`);

    await expect(page.getByText(prompt).first()).toBeVisible();
    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();
  });

  test("preserves conversation messages after page reload", async ({ page, request }) => {
    await bypassOnboarding(page);
    const prompt = "Reload persistence test";

    const session = await createSessionViaApi(request, projectId, prompt);
    await page.waitForTimeout(200);

    await page.goto(`/projects/${projectId}/sessions/${session.id}`);
    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();

    await page.reload();

    await expect(page.getByText(prompt).first()).toBeVisible();
    await expect(page.getByText(`Fake Agent: completed "${prompt}"`).first()).toBeVisible();
  });

  test("clicking a question answer resumes the conversation", async ({ page, request }) => {
    await bypassOnboarding(page);
    const prompt = `Question follow-up test ${QUESTION_PROMPT_TRIGGER}`;
    const session = await createSessionViaApi(request, projectId, prompt);
    await page.waitForTimeout(200);

    await page.goto(`/projects/${projectId}/sessions/${session.id}`);

    const answerOption = page.getByText("TypeScript", { exact: true });
    const sendButton = page.locator("[data-testid='send-message-button']");

    await expect(page.getByText("Which language do you want to use?").first()).toBeVisible();
    await expect(answerOption).toBeVisible();
    await expect(sendButton).toBeDisabled();

    await answerOption.click();
    await expect(sendButton).toBeEnabled();

    const followUpRequestPromise = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith(`/v1/sessions/${session.id}/follow-up`),
    );
    await sendButton.click();
    const followUpRequest = await followUpRequestPromise;
    expect(followUpRequest.postDataJSON()).toMatchObject({
      prompt: "Which language do you want to use?: TypeScript",
    });

    await expect(page.getByText("Which language do you want to use?: TypeScript").first()).toBeVisible();
    await expect(
      page.getByText('Fake Agent: follow-up "Which language do you want to use?: TypeScript"').first(),
    ).toBeVisible();
  });

  test("keeps chat input focus while typing in a new session", async ({ page }) => {
    await bypassOnboarding(page);

    await page.goto(`/projects/${projectId}/sessions`);

    const contentEditor = page.locator("[data-testid='content-editable']").first();

    await contentEditor.click();
    await page.keyboard.type("a");
    await expect(contentEditor).toContainText("a");

    await page.keyboard.type("bc");
    await expect(contentEditor).toContainText("abc");
  });

  test("shows the attached session panel on workspace routes and hides workspace hub", async ({ page, request }) => {
    test.slow();
    await bypassOnboarding(page);
    const prompt = "workspace attached panel regression";
    const repoRoot = createGitRepo("pstdio-e2e-sessions-repo-", "sessions e2e");
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, apiBase, projectId, "sessions-workspace-repo", repoRoot);
    const ticket = await createTicketViaApi(
      request,
      apiBase,
      projectId,
      "# Workspace panel ticket\n\nValidate hub visibility",
    );
    const attempt = await createAttemptWithSessionViaApi(request, apiBase, projectId, ticket.id, repo.id, prompt);

    await page.addInitScript(
      ({ id, sessionId }: { id: string; sessionId: string }) => {
        localStorage.setItem(
          `pstdio-project-settings/projects/${id}/values`,
          JSON.stringify({ state: { sessionModalState: "attached", selectedSessionId: sessionId }, version: 0 }),
        );
      },
      { id: projectId, sessionId: attempt.session.id },
    );
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.locator("[data-testid='session-attached-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='session-attached-panel']").getByText(prompt).first()).toBeVisible();
    await expect(page.locator("[data-testid='session-attached-panel']").getByText("Review changes")).toBeVisible();

    await page.goto(
      `/projects/${projectId}/tickets/${ticket.shorthand}/workspaces/${attempt.workspace.workspace_shorthand}`,
    );

    await expect(page.locator("[data-testid='session-attached-panel']")).toBeVisible();
    await expect(page.locator("[data-testid='session-attached-panel']").getByText(prompt).first()).toBeVisible();
    await expect(page.locator("[data-testid='session-attached-panel']").getByText("Review changes")).toHaveCount(0);
  });

  test("hides workspace hub in bubble view on workspace routes", async ({ page, request }) => {
    test.slow();
    await bypassOnboarding(page);
    const prompt = "workspace bubble panel regression";
    const repoRoot = createGitRepo("pstdio-e2e-sessions-repo-", "sessions e2e");
    repoDirs.push(repoRoot);
    const repo = await registerRepoViaApi(request, apiBase, projectId, "sessions-workspace-repo", repoRoot);
    const ticket = await createTicketViaApi(
      request,
      apiBase,
      projectId,
      "# Workspace bubble ticket\n\nValidate hub visibility",
    );
    const attempt = await createAttemptWithSessionViaApi(request, apiBase, projectId, ticket.id, repo.id, prompt);

    await page.addInitScript(
      ({ id, sessionId }: { id: string; sessionId: string }) => {
        localStorage.setItem(
          `pstdio-project-settings/projects/${id}/values`,
          JSON.stringify({ state: { sessionModalState: "bubble", selectedSessionId: sessionId }, version: 0 }),
        );
      },
      { id: projectId, sessionId: attempt.session.id },
    );
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(page.locator("[data-testid='session-bubble']")).toBeVisible();
    await expect(page.locator("[data-testid='session-bubble']").getByText(prompt).first()).toBeVisible();
    await expect(page.locator("[data-testid='session-bubble']").getByText("Review changes")).toBeVisible();

    await page.goto(
      `/projects/${projectId}/tickets/${ticket.shorthand}/workspaces/${attempt.workspace.workspace_shorthand}`,
    );

    await expect(page.locator("[data-testid='session-bubble']")).toBeVisible();
    await expect(page.locator("[data-testid='session-bubble']").getByText(prompt).first()).toBeVisible();
    await expect(page.locator("[data-testid='session-bubble']").getByText("Review changes")).toHaveCount(0);
  });

  test("shows only the 6 most recent sessions in the chat dropdown and links to sessions page", async ({
    page,
    request,
  }) => {
    await bypassOnboarding(page);

    await createSessionViaApi(request, projectId, "Session 1");
    await createSessionViaApi(request, projectId, "Session 2");
    await createSessionViaApi(request, projectId, "Session 3");
    await createSessionViaApi(request, projectId, "Session 4");
    await createSessionViaApi(request, projectId, "Session 5");
    await createSessionViaApi(request, projectId, "Session 6");
    await createSessionViaApi(request, projectId, "Session 7");

    await page.goto(`/projects/${projectId}/tickets`);

    await page.locator("button", { hasText: "New session" }).first().click();

    await expect(page.getByText("Session 7")).toBeVisible();
    await expect(page.getByText("Session 6")).toBeVisible();
    await expect(page.getByText("Session 5")).toBeVisible();
    await expect(page.getByText("Session 4")).toBeVisible();
    await expect(page.getByText("Session 3")).toBeVisible();
    await expect(page.getByText("Session 2")).toBeVisible();
    await expect(page.getByText("Session 1")).not.toBeVisible();

    await page.getByRole("option", { name: "View more sessions" }).click();
    await page.waitForURL(`**/projects/${projectId}/sessions`);
  });
});

test.describe("Session chat keyboard shortcuts", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(10_000);
    await deleteAllProjects(request);
    const project = await createProjectViaApi(request, "Sessions Chat Shortcut Test Project");
    projectId = project.id;
  });

  test("does not open shortcut help on Shift+7 in the chat composer", async ({ page }) => {
    await bypassOnboarding(page);

    await page.goto(`/projects/${projectId}/sessions`);

    const contentEditor = page.locator("[data-testid='content-editable'][contenteditable='true']").first();
    const client = await page.context().newCDPSession(page);

    await contentEditor.click();
    await client.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
      nativeVirtualKeyCode: 16,
      modifiers: 8,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "/",
      code: "Digit7",
      text: "/",
      unmodifiedText: "7",
      windowsVirtualKeyCode: 55,
      nativeVirtualKeyCode: 55,
      modifiers: 8,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "/",
      code: "Digit7",
      windowsVirtualKeyCode: 55,
      nativeVirtualKeyCode: 55,
      modifiers: 8,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
      nativeVirtualKeyCode: 16,
      modifiers: 0,
    });

    await expect(page.getByText("Keyboard Shortcuts")).toHaveCount(0);
  });
});
