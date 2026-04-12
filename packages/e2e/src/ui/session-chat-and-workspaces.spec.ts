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

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "fake");
  });
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, {
    data: { name },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const configureAgent = async (request: import("@playwright/test").APIRequestContext, agentId: string) => {
  const res = await request.post(`${apiBase}/v1/agents`, {
    data: { agent_id: agentId },
  });
  expect(res.ok()).toBe(true);
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
      agent: "fake",
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
    await configureAgent(request, "fake");
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
    const attempt = await createAttemptWithSessionViaApi(request, apiBase, ticket.id, repo.id, prompt);

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
    const attempt = await createAttemptWithSessionViaApi(request, apiBase, ticket.id, repo.id, prompt);

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

    await page.getByRole("link", { name: "View more sessions" }).click();
    await page.waitForURL(`**/projects/${projectId}/sessions`);
  });
});
