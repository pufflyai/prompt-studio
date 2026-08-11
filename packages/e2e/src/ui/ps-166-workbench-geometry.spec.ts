import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const dashboardWorkbenchStoryId = "pstdio-workbench-examples--dashboard-workbench";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];

  for (const project of projects) {
    const deleteResponse = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deleteResponse.ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "PS-166 Geometry" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/projects/${projectId}/tickets`);
};

const expectNear = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
};

const expectCanonicalFrame = async (
  page: import("@playwright/test").Page,
  options: { sidenav: "hidden" | "visible"; statusBar: "hidden" | "visible" },
) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const navChrome = page.locator('[data-workbench-region="nav"]');
  const sidePanel = page.locator('[data-workbench-region="side"]');
  const statusBar = page.locator('[data-workbench-region="status"]');

  if (options.sidenav === "visible") {
    await expect(sidenav).toBeVisible({ timeout: 45_000 });
  } else {
    await expect(sidenav).toHaveCount(0);
  }
  await expect(navChrome).toBeVisible();
  await expect(sidePanel).toBeVisible();
  if (options.statusBar === "visible") {
    await expect(statusBar).toBeVisible();
  } else {
    await expect(statusBar).toHaveCount(0);
  }
  await expect(page.locator('[data-workbench-region="activity"]')).toHaveCount(0);

  const [sidenavBox, navBox, sideBox] = await Promise.all([
    options.sidenav === "visible" ? sidenav.boundingBox() : Promise.resolve(null),
    navChrome.boundingBox(),
    sidePanel.boundingBox(),
  ]);
  expect(navBox).not.toBeNull();
  expect(sideBox).not.toBeNull();

  const contentHeight = options.statusBar === "visible" ? 688 : 720;
  const sidenavWidth = options.sidenav === "visible" ? 250 : 0;

  if (sidenavBox) {
    expectNear(sidenavBox.x, 0);
    expectNear(sidenavBox.y, 0);
    expectNear(sidenavBox.width, sidenavWidth);
    expectNear(sidenavBox.height, contentHeight);
  }

  expectNear(navBox!.x, sidenavWidth);
  expectNear(navBox!.y, 0);
  expectNear(navBox!.width, 860 - sidenavWidth);
  expectNear(navBox!.height, 40);

  expectNear(sideBox!.x, 860);
  expectNear(sideBox!.y, 0);
  expectNear(sideBox!.width, 420);
  expectNear(sideBox!.height, contentHeight);

  if (options.statusBar === "visible") {
    const statusBox = await statusBar.boundingBox();
    expect(statusBox).not.toBeNull();
    expectNear(statusBox!.x, 0);
    expectNear(statusBox!.y, 688);
    expectNear(statusBox!.width, 1280);
    expectNear(statusBox!.height, 32);
  }
};

test("PS-166 aligns an attached Side Panel with the active Location Panel", async ({ page, request }) => {
  test.setTimeout(30_000);
  await deleteAllProjects(request);
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
  expect(backlog).toBeDefined();
  await createPlannerTicket(request, apiBase, project.id, {
    content: "Canonical geometry",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);

  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText("Canonical geometry", { exact: true }).click();
  const nav = page.locator('[data-workbench-region="nav"]');
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();

  await expectCanonicalFrame(page, { sidenav: "visible", statusBar: "hidden" });
});

test("PS-166 keeps the Main Panel Header visible while the right menu is open", async ({ page, request }) => {
  test.setTimeout(30_000);
  await deleteAllProjects(request);
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
  expect(backlog).toBeDefined();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Main Panel Header regression",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText("Main Panel Header regression", { exact: true }).click();
  await expect(page.getByRole("link", { name: `${ticket.shorthand} Main Panel Header regression` })).toBeVisible();

  const mainPanelHeader = page.locator('[data-workbench-panel-header="main"]');
  const openMainRightMenu = page.getByRole("button", { name: "Show Main right menu" });
  if (await openMainRightMenu.isVisible()) await openMainRightMenu.click();

  await expect(page.locator('[data-workbench-region="main-right-menu"]')).toBeVisible();
  await expect(mainPanelHeader).toBeVisible();
});

test.describe("PS-166 canonical workbench Storybook frame", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(dashboardWorkbenchStoryId, "pstdio-workbench"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("names regions and keeps all Panel Headers equal", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, dashboardWorkbenchStoryId));

    await expectCanonicalFrame(page, { sidenav: "visible", statusBar: "visible" });

    const headerBoxes = await Promise.all(
      ["main", "secondary", "side"].map(async (panel) => {
        const header = page.locator(`[data-workbench-panel-header="${panel}"]`);
        await expect(header).toBeVisible();
        return header.boundingBox();
      }),
    );
    for (const box of headerBoxes) {
      expect(box).not.toBeNull();
      expectNear(box!.height, 40);
    }

    const secondaryDivider = page.getByRole("separator", { name: "Resize Secondary Panel" });
    await expect(secondaryDivider).toBeVisible();
    const dividerBox = await secondaryDivider.boundingBox();
    expect(dividerBox).not.toBeNull();
    expectNear(dividerBox!.height, 4);
  });
});
