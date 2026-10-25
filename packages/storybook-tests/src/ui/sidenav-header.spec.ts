import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./storybook";

const projectModeStoryId = "dashboard-sidenav--project-mode";
const workspacesViewStoryId = "dashboard-sidenav--workspaces-view";
const ticketModeStoryId = "dashboard-sidenav--ticket-mode";
const ticketWorkspaceBackStoryId = "dashboard-sidenav--ticket-workspace-back-journey";
const sessionModeStoryId = "dashboard-sidenav--session-mode";
const allSectionRowNames = ["Search", "Notifications", "Sessions", "Workspaces", "Tickets"] as const;
const withoutWorkspaces = allSectionRowNames.filter((name) => name !== "Workspaces");

const row = (sidenav: Locator, name: (typeof allSectionRowNames)[number]) =>
  name === "Workspaces" || name === "Notifications"
    ? sidenav
        .getByRole("option", {
          name: new RegExp(`^${name}(?:\\s|$)`),
        })
        .first()
    : sidenav.getByRole("option", { name, exact: true }).first();

const expectSidenavSections = async (
  sidenav: Locator,
  visibleNames: readonly (typeof allSectionRowNames)[number][] = withoutWorkspaces,
) => {
  const rows = visibleNames.map((name) => row(sidenav, name));
  for (const sectionRow of rows) await expect(sectionRow).toBeVisible({ timeout: 30_000 });

  const topEdges: number[] = [];
  for (const sectionRow of rows) {
    topEdges.push(await sectionRow.evaluate((element) => element.getBoundingClientRect().top));
  }
  expect(topEdges).toEqual([...topEdges].sort((left, right) => left - right));
  await expect(sidenav.locator('[data-workbench-panel-header="sidenav"]')).toHaveCount(0);
  await expect(sidenav.getByRole("tablist")).toHaveCount(0);
};

test.describe("Dashboard Sidenav stories", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(projectModeStoryId, "pstdio-dashboard"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  for (const storyId of [
    projectModeStoryId,
    workspacesViewStoryId,
    ticketModeStoryId,
    ticketWorkspaceBackStoryId,
    sessionModeStoryId,
  ]) {
    test(`renders ${storyId} as ordered sections without a panel header`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(storyUrl(baseUrl, storyId));

      const sidenav = page.locator('[data-workbench-region="sidenav"]');
      await expect(
        page.locator('[data-workbench-region="nav"]').getByRole("button", { name: /Prompt Studio$/ }),
      ).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
      if ([ticketModeStoryId, ticketWorkspaceBackStoryId, sessionModeStoryId].includes(storyId)) {
        await expect(row(sidenav, "Search")).toBeVisible();
        await expect(row(sidenav, "Workspaces")).toHaveCount(0);
      } else await expectSidenavSections(sidenav);
      if (storyId === ticketModeStoryId) {
        await expect(sidenav.getByRole("option", { name: "research.md", exact: true })).toBeVisible();
      }
      if (storyId === ticketWorkspaceBackStoryId)
        await expect(sidenav.getByRole("option", { name: "PS-164_A1", exact: true })).toBeVisible();
      if (storyId === sessionModeStoryId) {
        await expect(sidenav.locator('[data-tree-list-node-id="sessions"]')).toHaveCount(0);
        await expect(sidenav.getByRole("option", { name: "Refactor sidenav", exact: true })).toBeVisible();
        await expect(sidenav.getByRole("button", { name: "Help", exact: true })).toBeVisible();
        await expect(sidenav.getByRole("option", { name: "Settings", exact: true })).toBeVisible();
      }
    });
  }
});
