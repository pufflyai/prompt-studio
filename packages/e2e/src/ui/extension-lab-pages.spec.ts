import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Extension Lab Pages" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

test("an extension page navigates through the public API and browser history", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  await expect(page.getByText("Recent sessions", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-workbench-panel-header="sidenav"]')).toHaveCount(0);
  const sidenavEntries = await page.getByRole("option").allTextContents();
  expect(sidenavEntries.indexOf("Lab")).toBeLessThan(sidenavEntries.indexOf("Sessions"));
  await page.getByRole("option", { name: "Lab", exact: true }).click({ timeout: 30_000 });

  await expect(page).toHaveURL(`/projects/${project.id}/extensions/pstdio.extension-lab/lab`);
  const labFrame = page.frameLocator('iframe[title="Lab"]');
  await expect(labFrame.getByRole("heading", { name: "Sandbox webview" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("option", { name: "Lab", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: /Session 1 — first contact/ })).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(`/projects/${project.id}`);
  await expect(page.getByText("Recent sessions", { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="Lab"]')).toHaveCount(0);
  await expect(page.getByRole("option", { name: /Session 1 — first contact/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Lab", exact: true })).toBeVisible();

  await page.goForward();

  await expect(page).toHaveURL(`/projects/${project.id}/extensions/pstdio.extension-lab/lab`);
  await expect(labFrame.getByRole("heading", { name: "Sandbox webview" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Session 1 — first contact/ })).toBeVisible();
});

test("Tickets and Start remain exclusive page locations", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  await expect(page.getByText("Recent sessions", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("option", { name: "Tickets", exact: true }).click({ timeout: 30_000 });

  await expect(page).toHaveURL(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  await expect(page.getByRole("tab", { name: "Tickets", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: new RegExp(project.name) }).click();

  await expect(page).toHaveURL(`/projects/${project.id}`);
  await expect(page.getByText("Recent sessions", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tickets", exact: true })).toHaveCount(0);
});
