import { expect, test } from "@playwright/test";
import { createPlannerTicket } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-168 Side Panel" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/projects/${projectId}/tickets`);
};

const expectNear = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
};

const expectDashboardAttachedBounds = async (page: import("@playwright/test").Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const side = page.getByTestId("workbench-side-panel-attached");
  const [mainBox, sideBox] = await Promise.all([main.boundingBox(), side.boundingBox()]);
  expect(mainBox).not.toBeNull();
  expect(sideBox).not.toBeNull();

  expectNear(sideBox!.y, 0);
  expectNear(sideBox!.height, 720);
  expectNear(sideBox!.width, 420);
  expectNear(mainBox!.x + mainBox!.width, sideBox!.x);
  expectNear(sideBox!.x + sideBox!.width, 1280);
};

test("PS-168 closes and keyboard-restores the same full-height Side Panel", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Inspect Side Panel geometry" });
  await prepareDashboard(page, project.id);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText(ticket.content, { exact: true }).click();

  const nav = page.locator('[data-workbench-region="nav"]');
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
  await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
  await expectDashboardAttachedBounds(page);

  const mainNode = await page.locator('[data-workbench-region="main"]').elementHandle();
  const secondaryNode = await page.locator('[data-workbench-region="secondary"]').elementHandle();
  const sideRegionNode = await page.getByRole("region", { name: "Side Panel", exact: true }).elementHandle();
  expect(mainNode).not.toBeNull();
  expect(secondaryNode).not.toBeNull();
  expect(sideRegionNode).not.toBeNull();

  await nav.getByRole("button", { name: "Hide Side Panel" }).click();
  await expect(page.getByTestId("workbench-side-panel-attached")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open Side Panel" })).toBeVisible();
  await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);

  const closedMainBox = await page.locator('[data-workbench-panel="main"]').boundingBox();
  expect(closedMainBox).not.toBeNull();
  expectNear(closedMainBox!.x + closedMainBox!.width, 1280);
  expect(await mainNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await secondaryNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await sideRegionNode!.evaluate((element) => element.isConnected)).toBe(true);

  const showSide = nav.getByRole("button", { name: "Show Side Panel" });
  await showSide.focus();
  await expect(showSide).toBeFocused();
  await showSide.press("Enter");

  await expect(page.getByTestId("workbench-side-panel-attached")).toBeVisible();
  await expectDashboardAttachedBounds(page);
  expect(await mainNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await secondaryNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await sideRegionNode!.evaluate((element) => element.isConnected)).toBe(true);
});
