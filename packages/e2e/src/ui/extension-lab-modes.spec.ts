import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Extension Lab Modes" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "pstdio.extension-lab.fake",
          lastSelectedModels: [],
          lastSelectedRepo: "",
          lastSelectedBranches: [],
          sessionModalState: "closed",
          selectedSessionId: null,
        },
        version: 0,
      }),
    );
  }, projectId);
};

const labFrame = (page: import("@playwright/test").Page, title: string) =>
  page.frameLocator(`iframe[title="${title}"]`);

const openLabMode = async (page: import("@playwright/test").Page) => {
  await page.getByRole("option", { name: "Lab", exact: true }).click({ timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toBeVisible({ timeout: 30_000 });
};

test("the Lab mode swaps the sidenav for activity and status chrome without a terminal", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  await openLabMode(page);

  // One mode, three main tabs.
  await expect(page.getByRole("tab", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Cams", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  const overviewFrame = labFrame(page, "Overview");
  await expect(overviewFrame.getByRole("heading", { name: "Sandbox webview" })).toBeVisible({ timeout: 30_000 });

  // The native activity rail replaces the sidenav and the status strip reports lab state.
  const activityRail = page.locator('[data-workbench-region="activity"]');
  await expect(activityRail).toBeVisible({ timeout: 30_000 });
  await expect(activityRail.getByRole("button", { name: "Create artifact" })).toBeVisible();
  await expect(page.locator('[data-workbench-region="sidenav"]')).toHaveCount(0);
  const statusBar = labFrame(page, "Lab status");
  await expect(statusBar.getByText("Extension Lab")).toBeVisible({ timeout: 30_000 });

  // No secondary panel means no place to open a terminal in the Lab.
  await expect(page.locator('[data-workbench-panel="secondary"]')).toHaveCount(0);

  // Leaving through the rail's home item restores the dashboard sidenav.
  await activityRail.getByRole("button", { name: "Project home" }).click();
  await expect(page.locator('[data-workbench-region="sidenav"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-workbench-region="activity"]')).toHaveCount(0);
});

test("the Cameras tree menu drives the cams player", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  await openLabMode(page);
  await page.getByRole("tab", { name: "Cams", exact: true }).click();

  const camsFrame = labFrame(page, "Cams");
  await expect(camsFrame.getByText(/Session 1/)).toBeVisible({ timeout: 30_000 });

  const camsMenu = page.locator('[data-workbench-panel-menu="main-left"]');
  await expect(camsMenu.getByText("Corridor B — night sweep")).toBeVisible({ timeout: 30_000 });
  const selectResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/extensions/commands/extension-lab.cams.select/execute") &&
      response.request().method() === "POST",
  );
  await camsMenu.getByText("Corridor B — night sweep").click();
  expect((await selectResponse).ok()).toBe(true);
  await expect(camsFrame.getByText(/Corridor B/)).toBeVisible({ timeout: 15_000 });
});

test("artifacts are created from the panel menu and inspected in the Side Panel", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  await openLabMode(page);
  await page.getByRole("tab", { name: "Artifacts", exact: true }).click();

  // The Create artifacts menu lives on the Artifacts panel itself.
  const createMenu = page.locator('[data-workbench-panel-menu="main-right"]');
  await expect(createMenu.getByText("Catalog intake")).toBeVisible({ timeout: 30_000 });
  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/extensions/commands/extension-lab.artifact-menu.update/execute") &&
      response.request().method() === "POST",
  );
  await createMenu.getByRole("button", { name: "Random artifact" }).click();
  expect((await createResponse).ok()).toBe(true);

  const dataTable = page.locator("table.data-table");
  await expect(dataTable.locator("tbody tr")).toHaveCount(1, { timeout: 15_000 });
  const artifactTitle = await dataTable.locator("td[data-column-id='artifact']").first().textContent();

  // Selecting a row opens the Side Panel inspector without leaving the Lab.
  await dataTable.locator("td[data-column-id='artifact']").first().click();
  const detailFrame = labFrame(page, "Artifact");
  await expect(detailFrame.getByRole("heading", { name: artifactTitle! })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(page.locator('[data-workbench-region="activity"]')).toBeVisible();

  // Row actions still delete artifacts.
  await dataTable.locator("tbody tr").first().locator('button[aria-label="Row actions"]').click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/extension-lab.glass-lab-artifacts.delete/execute",
      ) && response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Delete artifact" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "No artifacts found" })).toBeVisible({ timeout: 15_000 });
});
