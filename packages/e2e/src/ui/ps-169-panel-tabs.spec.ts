import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createPlannerTicket } from "../helpers/planner-api";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const sidePanelsStoryId = "pstdio-workbench-onboarding--side-panels";
const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const getVerticalMenuGap = async (
  tab: import("@playwright/test").Locator,
  menu: import("@playwright/test").Locator,
) => {
  const tabBox = await tab.boundingBox();
  const menuBox = await menu.boundingBox();
  if (!tabBox || !menuBox) throw new Error("Tab menu geometry is unavailable");
  return Math.abs(menuBox.y - (tabBox.y + tabBox.height));
};

const openTabCustomMenu = async (tab: import("@playwright/test").Locator) => {
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await tab.click();
};

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  for (const project of (await response.json()) as Array<{ id: string }>) {
    expect((await request.delete(`${apiBase}/v1/projects/${project.id}`)).ok()).toBe(true);
  }
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-169 Panel tabs" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

test("PS-169 opens the active Session tab's custom menu", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, project.id);
  await page.setViewportSize({ width: 1280, height: 720 });
  const ticket = await createPlannerTicket(request, apiBase, project.id, { content: "Inspect Session tab menu" });
  await page.goto(`/projects/${project.id}/tickets`);
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText(ticket.content, { exact: true }).click();

  const nav = page.locator('[data-workbench-region="nav"]');
  await nav.getByRole("button", { name: "Show Side Panel" }).click();
  await page.locator('[data-workbench-panel-header="side"]').getByRole("button", { name: "Add panel" }).click();
  const sessionTab = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: /New session/ });
  await expect(sessionTab).toBeVisible();
  await openTabCustomMenu(sessionTab);

  const sessionMenu = page.getByRole("menu", { name: "New session menu" });
  await expect(sessionMenu).toBeVisible();
  await expect(sessionMenu.getByRole("menuitem", { name: "New session" })).toBeVisible();
  await expect(sessionMenu.getByRole("menuitem", { name: "View all sessions" })).toBeVisible();
  await expect(sessionMenu.getByRole("menuitem", { name: "No sessions yet" })).toBeVisible();

  await expect.poll(() => getVerticalMenuGap(sessionTab, sessionMenu)).toBeLessThanOrEqual(1);
});

test.describe("PS-169 Panel tabs", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(sidePanelsStoryId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("adds an eligible widget to its owning Panel from the anchored add menu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, sidePanelsStoryId));

    for (const panel of ["main", "secondary", "side"]) {
      await expect(
        page.locator(`[data-workbench-panel-header="${panel}"]`).getByRole("button", { name: "Add panel" }),
      ).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    }

    const activityTab = page.getByRole("tab", { name: /Activity Live/ });
    await activityTab.click();
    await expect(
      page.getByRole("menu", { name: "Activity menu" }).getByRole("menuitem", { name: "Live context" }),
    ).toBeVisible();

    const activityMenu = page.getByRole("menu", { name: "Activity menu" });
    await expect.poll(() => getVerticalMenuGap(activityTab, activityMenu)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");

    const addSidePanel = page
      .locator('[data-workbench-panel-header="side"]')
      .getByRole("button", { name: "Add panel" });
    await addSidePanel.click();
    await expect(page.getByRole("menu", { name: "Add panel" })).toHaveCount(0);

    const sideHeader = page.locator('[data-workbench-panel-header="side"]');
    await expect(sideHeader.getByRole("tab", { name: "Files" })).toBeVisible();
    await expect(sideHeader.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");

    await expect(addSidePanel).toHaveCount(0);
  });
});
