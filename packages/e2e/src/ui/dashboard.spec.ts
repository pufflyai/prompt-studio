import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
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
  return (await res.json()) as { id: string; title: string };
};

test("API health check responds ok", async ({ request }) => {
  test.setTimeout(5_000);
  const response = await request.get(`${apiBase}/healthz`);

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.ok).toBe(true);
});

test("dashboard loads successfully", async ({ page }) => {
  test.setTimeout(5_000);
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();
  // The dashboard SPA should render without a hard error
  await expect(page.locator("text=Not found")).not.toBeVisible();
});

test("dashboard opens the start page for a selected project without a saved location", async ({ page, request }) => {
  test.setTimeout(10_000);
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Dashboard Start Test");
  const session = await createSessionViaApi(request, project.id, "Recent start session");

  await page.addInitScript((selectedProjectId) => {
    window.localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, project.id);

  await page.goto("/");

  await expect(page.getByRole("option", { name: "Start" })).toHaveCount(0);
  await expect(page.getByLabel("Main").getByText("Recent sessions", { exact: true })).toBeVisible();
  await page
    .getByLabel("Main")
    .getByRole("button", { name: /Recent start session/ })
    .click();

  await expect(page.getByLabel("Main").getByText("Recent sessions", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("workbench-session-bubble").getByRole("button", { name: "Select session" }).filter({
      hasText: session.title,
    }),
  ).toBeVisible();
});
