import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "../storybook";

const prefix = "pstdio-workbench-reference-core-api-page-menu-header--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}with-closed-view-menu`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

test("a tabless page shows only its closed view menu openers in a borderless header", async ({ page }) => {
  test.slow();
  await page.goto(storyUrl(baseUrl, `${prefix}with-closed-view-menu`));
  await waitForStoryPlayback(page);
  const header = page.locator('[data-workbench-page-menu-header="main"]');
  await expect(header).toBeVisible();
  await expect(page.locator('[data-workbench-panel-header="main"]')).toHaveCount(0);
  await expect(header.getByRole("tab")).toHaveCount(0);
  await expect(header.getByRole("button")).toHaveCount(1);
  await expect(header).toHaveCSS("border-bottom-width", "0px");
  await expect(header).not.toHaveAttribute("data-panel-draggable");

  // The header is not a panel drag handle, so pressing and moving it offers no placement targets.
  const bounds = (await header.boundingBox())!;
  await page.mouse.move(bounds.x + 8, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 80, bounds.y + bounds.height / 2 + 120, { steps: 5 });
  await expect(page.locator("[data-workbench-edge-hit], [data-workbench-edge-drop]")).toHaveCount(0);
  await page.mouse.up();

  await header.getByRole("button", { name: "Open Main right menu" }).click();
  const menu = page.locator('[data-workbench-panel-menu="main-right"]');
  await expect(menu).toBeVisible();
  await expect(menu.getByText("Board properties")).toBeVisible();
  await expect(header).toHaveCount(0);
});

test("a tabless page without view menus has no Main header", async ({ page }) => {
  test.slow();
  await page.goto(storyUrl(baseUrl, `${prefix}without-view-menus`));
  await waitForStoryPlayback(page);
  await expect(page.getByText("Board content")).toBeVisible();
  await expect(page.locator('[data-workbench-page-menu-header="main"]')).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel-header="main"]')).toHaveCount(0);
});
