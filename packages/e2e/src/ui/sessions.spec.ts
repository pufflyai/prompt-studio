import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "opencode");
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
      agent: "opencode",
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

test.describe("Sessions page", () => {
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    test.setTimeout(10_000);
    await deleteAllProjects(request);
    await configureAgent(request, "opencode");
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
});
