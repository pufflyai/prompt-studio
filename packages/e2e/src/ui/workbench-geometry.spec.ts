import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];

  for (const project of projects) {
    const deleteResponse = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deleteResponse.ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-166 Geometry" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/projects/${projectId}/tickets`);
};

// Panels are inset from the window and separated from each other by the panel gap.
const PANEL_GAP_PX = 4;
const PANEL_BORDER_PX = 1;

const expectNear = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
};

const expectCanonicalFrame = async (
  page: import("@playwright/test").Page,
  options: { sidenav: "hidden" | "visible"; statusBar: "hidden" | "visible" },
) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const mainPanel = page.locator('[data-workbench-panel="main"]');
  const navChrome = mainPanel.locator('[data-workbench-region="nav"]');
  const sidePanel = page.locator('[data-workbench-region="side"]');
  const statusBar = page.locator('[data-workbench-region="status"]');

  if (options.sidenav === "visible") {
    await expect(sidenav).toBeVisible({ timeout: 45_000 });
  } else {
    await expect(sidenav).toBeHidden();
  }
  await expect(navChrome).toBeVisible();
  await expect(sidePanel).toBeVisible();
  if (options.statusBar === "visible") {
    await expect(statusBar).toBeVisible();
  } else {
    await expect(statusBar).toBeHidden();
  }
  await expect(page.locator('[data-workbench-region="activity"]')).toBeHidden();

  const [sidenavBox, mainBox, navBox, sideBox] = await Promise.all([
    options.sidenav === "visible" ? sidenav.boundingBox() : Promise.resolve(null),
    mainPanel.boundingBox(),
    navChrome.boundingBox(),
    sidePanel.boundingBox(),
  ]);
  expect(mainBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(sideBox).not.toBeNull();

  const contentHeight = options.statusBar === "visible" ? 688 : 720;
  const panelHeight = contentHeight - 2 * PANEL_GAP_PX;
  const sidenavWidth = options.sidenav === "visible" ? 250 : 0;
  const sideX = 1280 - PANEL_GAP_PX - 420;
  const mainColumnX = PANEL_GAP_PX + sidenavWidth + (options.sidenav === "visible" ? PANEL_GAP_PX : 0);

  if (sidenavBox) {
    expectNear(sidenavBox.x, PANEL_GAP_PX);
    expectNear(sidenavBox.y, PANEL_GAP_PX);
    expectNear(sidenavBox.width, sidenavWidth);
    expectNear(sidenavBox.height, panelHeight);
  }

  expectNear(mainBox!.x, mainColumnX);
  expectNear(mainBox!.y, PANEL_GAP_PX);
  expectNear(mainBox!.width, sideX - PANEL_GAP_PX - mainColumnX);
  expectNear(mainBox!.height, panelHeight);

  // The breadcrumb belongs inside Main's frame, below its top border.
  expectNear(navBox!.x, mainBox!.x + PANEL_BORDER_PX);
  expectNear(navBox!.y, mainBox!.y + PANEL_BORDER_PX);
  expectNear(navBox!.width, mainBox!.width - 2 * PANEL_BORDER_PX);
  expectNear(navBox!.height, 40);

  expectNear(sideBox!.x, sideX);
  expectNear(sideBox!.y, PANEL_GAP_PX);
  expectNear(sideBox!.width, 420);
  expectNear(sideBox!.height, panelHeight);

  if (options.statusBar === "visible") {
    const statusBox = await statusBar.boundingBox();
    expect(statusBox).not.toBeNull();
    expectNear(statusBox!.x, 0);
    expectNear(statusBox!.y, 688);
    expectNear(statusBox!.width, 1280);
    expectNear(statusBox!.height, 32);
  }
};

test("aligns Main and attached Side frames with the breadcrumb inside Main", async ({ page, request }) => {
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
  await page.getByRole("menuitem", { name: "Session", exact: true }).click();

  await expectCanonicalFrame(page, { sidenav: "visible", statusBar: "hidden" });
});

test("reopens the Main right menu from a single-resource page", async ({ page, request }) => {
  test.setTimeout(30_000);
  await deleteAllProjects(request);
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const backlog = statuses.find((status) => status.name.toLowerCase() === "backlog");
  expect(backlog).toBeDefined();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Reopen ticket details",
    statusId: backlog!.id,
  });
  await prepareDashboard(page, project.id);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText("Reopen ticket details", { exact: true }).click();
  const ticketLink = page.getByRole("link", { name: `${ticket.shorthand} Reopen ticket details` });
  await expect(ticketLink).toBeVisible();

  const mainPanelHeader = page.locator('[data-workbench-panel-header="main"]');
  const rightMenu = page.locator('[data-workbench-panel-menu="main-right"]');
  await expect(rightMenu).toBeVisible();
  await expect(mainPanelHeader.getByRole("button", { name: "Add panel", exact: true })).toBeVisible();
  await expect(mainPanelHeader.getByRole("tab")).toHaveCount(0);

  await page.getByRole("separator", { name: "Resize Main right menu" }).press("Home");
  await expect(rightMenu).toBeHidden();
  await expect(mainPanelHeader).toBeVisible();
  await mainPanelHeader.getByRole("button", { name: "Open Main right menu" }).click();

  await expect(rightMenu).toBeVisible();
  await expect(page.getByRole("menu", { name: "Main right menu controls" })).toHaveCount(0);
  await expect(mainPanelHeader.getByRole("button", { name: "Add panel", exact: true })).toBeVisible();
  await expect(mainPanelHeader.getByRole("tab")).toHaveCount(0);
  await expect(ticketLink).toBeVisible();
});
