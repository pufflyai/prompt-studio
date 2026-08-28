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
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({
        state: {
          lastSelectedAgent: "pstdio.extension-lab.harness.fake",
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
  await expect(overviewFrame.getByText("0", { exact: true })).toBeVisible();
  await overviewFrame.getByRole("button", { name: "Increment" }).click();
  await expect(overviewFrame.getByText("1", { exact: true })).toBeVisible();

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
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.extension-lab.command.cams.select/execute",
      ) && response.request().method() === "POST",
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
  const dataTable = page.locator("table.data-table");
  const rows = dataTable.locator("tbody tr");
  await expect(rows).toHaveCount(2, { timeout: 15_000 });
  const initialArtifactCount = await rows.count();
  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.extension-lab.view.artifact-create.controls.onValueChange/execute",
      ) && response.request().method() === "POST",
  );
  await createMenu.getByRole("button", { name: "Random artifact" }).click();
  const response = await createResponse;
  expect(response.ok()).toBe(true);
  const created = (await response.json()) as { outcome: { value: { title: string } } };

  await expect(rows).toHaveCount(initialArtifactCount + 1, { timeout: 15_000 });
  const createdArtifact = rows.filter({ hasText: created.outcome.value.title });

  // Selecting a row opens the Side Panel inspector without leaving the Lab.
  await createdArtifact.locator("td[data-column-id='artifact']").click();
  const detailFrame = labFrame(page, "Artifact");
  await expect(detailFrame.getByRole("heading", { name: created.outcome.value.title })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("tab", { name: "Artifacts", exact: true })).toBeVisible();
  await expect(page.locator('[data-workbench-region="activity"]')).toBeVisible();

  // Row actions still delete artifacts.
  await createdArtifact.locator('button[aria-label="Row actions"]').click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        "/extensions/commands/pstdio.extension-lab.command.glass-lab-artifacts.delete/execute",
      ) && response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Delete artifact" }).click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(rows).toHaveCount(initialArtifactCount, { timeout: 15_000 });
});
