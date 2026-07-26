import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createPlannerTicket } from "../helpers/planner-api";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const sidePanelsStoryId = "pstdio-workbench-onboarding--side-panels";

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
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/projects/${projectId}/tickets`);
};

const expectNear = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
};

const expectDashboardAttachedBounds = async (page: import("@playwright/test").Page) => {
  const main = page.locator('[data-workbench-panel="main"]');
  const side = page.getByTestId("workbench-session-attached-panel");
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
  await expect(page.getByTestId("workbench-session-attached-panel")).toBeVisible();
  await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
  await expectDashboardAttachedBounds(page);

  const mainNode = await page.locator('[data-workbench-region="main"]').elementHandle();
  const secondaryNode = await page.locator('[data-workbench-region="secondary"]').elementHandle();
  const sideRegionNode = await page.getByRole("region", { name: "Session", exact: true }).elementHandle();
  expect(mainNode).not.toBeNull();
  expect(secondaryNode).not.toBeNull();
  expect(sideRegionNode).not.toBeNull();

  await nav.getByRole("button", { name: "Hide Side Panel" }).click();
  await expect(page.getByTestId("workbench-session-attached-panel")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open session panel" })).toBeVisible();
  await expect(page.getByTestId("workbench-session-bubble")).toHaveCount(0);

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

  await expect(page.getByTestId("workbench-session-attached-panel")).toBeVisible();
  await expectDashboardAttachedBounds(page);
  expect(await mainNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await secondaryNode!.evaluate((element) => element.isConnected)).toBe(true);
  expect(await sideRegionNode!.evaluate((element) => element.isConnected)).toBe(true);
});

test.describe("PS-168 Side Panels Storybook contract", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(sidePanelsStoryId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("shows equal headers and closes from the Side Panel edge without floating", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, sidePanelsStoryId));

    const side = page.getByTestId("workbench-session-attached-panel");
    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    const main = page.locator('[data-workbench-panel="main"]');
    const separator = page.getByRole("separator", { name: "Resize Side Panel" });
    await expect(side).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    const [sideBox, sidenavBox, mainBox] = await Promise.all([
      side.boundingBox(),
      sidenav.boundingBox(),
      main.boundingBox(),
    ]);
    expect(sideBox).not.toBeNull();
    expect(sidenavBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    expectNear(sideBox!.y, sidenavBox!.y);
    expectNear(sideBox!.height, sidenavBox!.height);
    expectNear(sideBox!.width, 420);
    expectNear(mainBox!.x + mainBox!.width, sideBox!.x);

    for (const panel of ["main", "side"]) {
      const box = await page.locator(`[data-workbench-panel-header="${panel}"]`).boundingBox();
      expect(box).not.toBeNull();
      expectNear(box!.height, 40);
    }

    const separatorBox = await separator.boundingBox();
    expect(separatorBox).not.toBeNull();
    const x = separatorBox!.x + separatorBox!.width / 2;
    const y = separatorBox!.y + separatorBox!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 300, y);
    await page.mouse.up();

    await expect(side).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Show Side Panel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open session panel" })).toBeVisible();
    await expect(page.getByTestId("workbench-session-bubble")).toHaveCount(0);
  });
});
