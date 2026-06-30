import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
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
      agent: "pstdio.extension-lab.fake",
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string };
};

const getSessionViaApi = async (request: import("@playwright/test").APIRequestContext, sessionId: string) => {
  const res = await request.get(`${apiBase}/v1/sessions/${sessionId}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; status: string };
};

const archiveSessionViaApi = async (request: import("@playwright/test").APIRequestContext, sessionId: string) => {
  const res = await request.post(`${apiBase}/v1/sessions/${sessionId}/archive`);
  expect(res.ok()).toBe(true);
};

const updateSessionStatusViaApi = async (
  request: import("@playwright/test").APIRequestContext,
  sessionId: string,
  status: string,
) => {
  const res = await request.patch(`${apiBase}/v1/sessions/${sessionId}/status`, {
    data: { status },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; status: string };
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

const getSessionBubble = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Attach panel" }) });

test.describe("Sessions page", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(10_000);
    await deleteAllProjects(request);
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
    await page.goto(`/projects/${projectId}/tickets`);

    await expect(getSessionBubble(page)).toBeVisible();

    await page.goto(`/projects/${projectId}/sessions`);

    await expect(getSessionBubble(page)).toHaveCount(0);
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

  test("shows action menu with archive option", async ({ page, request }) => {
    await bypassOnboarding(page);

    await createSessionViaApi(request, projectId, "Action menu test");

    await page.goto(`/projects/${projectId}/sessions`);
    await page.getByText("Action menu test").click();

    await page.getByRole("button", { name: "Session actions" }).click();
    await expect(page.getByText("Archive session")).toBeVisible();
  });

  test("stops an active session from the chat composer", async ({ page, request }) => {
    await bypassOnboarding(page);

    const session = await createSessionViaApi(request, projectId, "Interruptible session");
    await expect.poll(async () => (await getSessionViaApi(request, session.id)).status).toBe("completed");
    await updateSessionStatusViaApi(request, session.id, "in_progress");

    await page.goto(`/projects/${projectId}/sessions/${session.id}`);

    const stopFromEnter = page
      .waitForRequest((req) => req.url().endsWith(`/v1/sessions/${session.id}/status`) && req.method() === "PATCH", {
        timeout: 500,
      })
      .then(() => true)
      .catch(() => false);
    const contentEditor = page.locator("[data-testid='content-editable'][contenteditable='true']").last();
    await contentEditor.fill("Enter should not stop");
    await contentEditor.press("Enter");

    expect(await stopFromEnter).toBe(false);
    await expect(page.getByRole("button", { name: "Stop Response" })).toBeVisible();

    const stopResponse = page.waitForResponse(
      (res) => res.url().endsWith(`/v1/sessions/${session.id}/status`) && res.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Stop Response" }).click();
    const res = await stopResponse;

    expect(page.url()).toContain(`/projects/${projectId}/sessions/${session.id}`);
    expect((await res.json()) as { status: string }).toMatchObject({ status: "cancelled" });
    await expect(page.getByRole("button", { name: "Stop Response" })).toHaveCount(0);
    await expect.poll(async () => (await getSessionViaApi(request, session.id)).status).toBe("cancelled");
  });

  test("shows only the 6 most recent sessions in the chat dropdown and navigates to the sessions page", async ({
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

    await page.getByRole("menuitem", { name: "View more sessions" }).click();
    await page.waitForURL(`**/projects/${projectId}/sessions`);
  });
});
