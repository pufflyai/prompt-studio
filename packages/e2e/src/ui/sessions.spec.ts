import { expect, test } from "@playwright/test";

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

const archiveSessionViaApi = async (request: import("@playwright/test").APIRequestContext, sessionId: string) => {
  const res = await request.post(`${apiBase}/v1/sessions/${sessionId}/archive`);
  expect(res.ok()).toBe(true);
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

test.describe("Sessions page", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(10_000);
    await deleteAllProjects(request);
    await configureAgent(request, "fake");
    const project = await createProjectViaApi(request, "Sessions Test Project");
    projectId = project.id;
  });

  test("shows empty state when no sessions exist", async ({ page }) => {
    await bypassOnboarding(page);
    await page.goto(`/projects/${projectId}/sessions`);

    await expect(page.getByText("No sessions yet")).toBeVisible();
  });

  test("lists sessions created via API", async ({ page, request }) => {
    await bypassOnboarding(page);

    await createSessionViaApi(request, projectId, "Fix authentication bug");
    await createSessionViaApi(request, projectId, "Add search feature");

    await page.goto(`/projects/${projectId}/sessions`);

    await expect(page.getByText("Fix authentication bug")).toBeVisible();
    await expect(page.getByText("Add search feature")).toBeVisible();
  });

  test("hides archived sessions from the sessions page list", async ({ page, request }) => {
    await bypassOnboarding(page);

    await createSessionViaApi(request, projectId, "Visible session");
    const archivedSession = await createSessionViaApi(request, projectId, "Archived session");
    await archiveSessionViaApi(request, archivedSession.id);

    await page.goto(`/projects/${projectId}/sessions`);

    await expect(page.getByText("Visible session")).toBeVisible();
    await expect(page.getByText("Archived session")).not.toBeVisible();
  });

  test("hides the floating session bubble on sessions routes", async ({ page }) => {
    await bypassOnboarding(page);
    await page.addInitScript((id: string) => {
      localStorage.setItem(
        `pstdio-project-settings/projects/${id}/values`,
        JSON.stringify({ state: { sessionModalState: "bubble" }, version: 0 }),
      );
    }, projectId);
    await page.goto(`/projects/${projectId}/docs`);

    await expect(page.locator("[data-testid='session-bubble']")).toBeVisible();

    await page.goto(`/projects/${projectId}/sessions`);

    await expect(page.locator("[data-testid='session-bubble']")).toHaveCount(0);
  });

  test("navigates to session on click", async ({ page, request }) => {
    await bypassOnboarding(page);

    const session = await createSessionViaApi(request, projectId, "Navigation test session");

    await page.goto(`/projects/${projectId}/sessions`);
    await page.getByText("Navigation test session").click();

    await page.waitForURL(`**/sessions/${session.id}`);
    expect(page.url()).toContain(`/sessions/${session.id}`);
  });

  test("shows session title in header when selected", async ({ page, request }) => {
    await bypassOnboarding(page);

    await createSessionViaApi(request, projectId, "Header title test");

    await page.goto(`/projects/${projectId}/sessions`);
    await page.getByText("Header title test").click();

    const header = page.locator("text=Header title test");
    await expect(header.first()).toBeVisible();
  });

  test("shows action menu with download option", async ({ page, request }) => {
    await bypassOnboarding(page);

    await createSessionViaApi(request, projectId, "Action menu test");

    await page.goto(`/projects/${projectId}/sessions`);
    await page.getByText("Action menu test").click();

    await page.getByRole("button", { name: "Session actions" }).click();
    await expect(page.getByText("Download session JSON")).toBeVisible();
    await expect(page.getByText("Archive session")).toBeVisible();
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

    // Wait for the fake agent to complete and persist messages
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

  test("opens selected session in bubble and navigates back", async ({ page, request }) => {
    await bypassOnboarding(page);
    await page.addInitScript((id: string) => {
      localStorage.setItem(
        `pstdio-project-settings/projects/${id}/values`,
        JSON.stringify({
          state: {
            lastNonSessionsPath: `/projects/${id}/docs`,
          },
          version: 0,
        }),
      );
    }, projectId);
    const session = await createSessionViaApi(request, projectId, "Open in bubble session");

    await page.goto(`/projects/${projectId}/sessions/${session.id}`);
    await page.getByRole("button", { name: "Open in bubble" }).click();

    await page.waitForURL(`**/projects/${projectId}/docs`);
    const sessionBubble = page.locator("[data-testid='session-bubble']");
    await expect(sessionBubble).toBeVisible();
    await expect(sessionBubble.getByText("Open in bubble session").first()).toBeVisible();
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

    await page.goto(`/projects/${projectId}/docs`);

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
