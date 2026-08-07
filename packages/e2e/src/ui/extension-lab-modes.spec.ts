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

const modeFrame = (page: import("@playwright/test").Page, title: string) =>
  page.frameLocator(`iframe[title="${title}"]`);

const switchMode = async (page: import("@playwright/test").Page, label: string) => {
  await page.keyboard.press("ControlOrMeta+KeyK");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("> switch mode");
  await dialog.getByText("Switch Mode", { exact: true }).click();
  await dialog.getByPlaceholder("Search modes").fill(label);
  await dialog.getByText(label, { exact: true }).click();
  await expect(dialog).toBeHidden();
};

test("Extension Lab demonstrates mode-owned layouts and restores prior Panel state", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  const projectSidenav = page.locator('[data-workbench-region="sidenav"]');
  await projectSidenav.getByRole("option", { name: "Lab coding mode", exact: true }).click({ timeout: 30_000 });

  await expect(modeFrame(page, "Lab overview").getByRole("heading", { name: "Sandbox webview" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(modeFrame(page, "Coding tools").getByRole("heading", { name: "Coding tools" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(modeFrame(page, "Inspector").getByRole("heading", { name: "Inspector" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Show Secondary Panel" }).click();
  await expect(modeFrame(page, "Experiment console").getByRole("heading", { name: "Experiment console" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Hide Secondary Panel" }).click();
  await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();

  await switchMode(page, "Lab design");
  await expect(modeFrame(page, "Prototype canvas").getByRole("heading", { name: "Prototype canvas" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(modeFrame(page, "Design palette").getByRole("heading", { name: "Design palette" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-workbench-panel="secondary"]')).toHaveCount(0);

  await switchMode(page, "Lab review");
  await expect(modeFrame(page, "Change review").getByRole("heading", { name: "Change review" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Show Secondary Panel" }).click();
  await expect(modeFrame(page, "Review checks").getByRole("heading", { name: "Review checks" })).toBeVisible({
    timeout: 30_000,
  });

  await switchMode(page, "Lab focus");
  await expect(modeFrame(page, "Focus").getByRole("heading", { name: "Main only" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-workbench-panel="secondary"]')).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel-menu^="main-"]')).toHaveCount(0);

  await switchMode(page, "Lab coding");
  await expect(modeFrame(page, "Lab overview").getByRole("heading", { name: "Sandbox webview" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Show Secondary Panel" })).toBeVisible();
  await page.getByRole("button", { name: "Show Secondary Panel" }).click();
  await expect(modeFrame(page, "Experiment console").getByRole("heading", { name: "Experiment console" })).toBeVisible({
    timeout: 30_000,
  });
});

test("Extension Lab keeps project navigation available inside a custom mode", async ({ page, request }) => {
  test.slow();
  const project = await createProject(request);
  await prepareDashboard(page, project.id);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${project.id}`);

  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await sidenav.getByRole("option", { name: "Lab coding mode", exact: true }).click({ timeout: 30_000 });
  await expect(modeFrame(page, "Lab overview").getByRole("heading", { name: "Sandbox webview" })).toBeVisible({
    timeout: 30_000,
  });

  const labRow = sidenav.getByRole("option", { name: "Lab", exact: true });
  await expect(labRow).toBeVisible();
  await labRow.click();
  await expect(modeFrame(page, "Lab").getByRole("heading", { name: "Sandbox webview" })).toBeVisible({
    timeout: 30_000,
  });

  await sidenav.getByRole("option", { name: "Lab coding mode", exact: true }).click();
  await expect(modeFrame(page, "Lab overview").getByRole("heading", { name: "Sandbox webview" })).toBeVisible({
    timeout: 30_000,
  });

  await sidenav
    .getByRole("option", { name: /^Workspaces/ })
    .first()
    .click();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Workspaces", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
});
