import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const storyId = "pstdio-workbench-onboarding--responsive-panel-menus";

const panel = (page: Page, region: "main" | "secondary" | "side") => page.locator(`[data-workbench-panel="${region}"]`);

const menu = (page: Page, region: "main" | "secondary" | "side", side: "left" | "right") =>
  page.locator(`[data-workbench-panel-menu="${region}-${side}"]`);

const trigger = (page: Page, panelName: "Main" | "Secondary" | "Side", side: "left" | "right") =>
  page.getByRole("button", { name: `Open ${panelName} ${side} menu` });

const resizeViewportPanel = async (page: Page, target: Locator, targetWidth: number) => {
  const currentWidth = await target.evaluate((element) => element.clientWidth);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Expected a viewport");
  await page.setViewportSize({
    width: viewport.width + targetWidth - currentWidth,
    height: viewport.height,
  });
  await expect.poll(() => target.evaluate((element) => element.clientWidth)).toBe(targetWidth);
};

const resizeSidePanel = async (page: Page, targetWidth: number) => {
  const sidePanel = panel(page, "side");
  const separator = page.getByRole("separator", { name: "Resize Side Panel" });
  const [currentWidth, separatorBox] = await Promise.all([
    sidePanel.evaluate((element) => element.clientWidth),
    separator.boundingBox(),
  ]);
  if (!separatorBox) throw new Error("Expected the Side Panel resize geometry");
  const startX = separatorBox.x + separatorBox.width / 2;
  const y = separatorBox.y + separatorBox.height / 2;
  const targetX = startX - (targetWidth - currentWidth);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(targetX, y);
  await page.mouse.up();
  await expect.poll(() => sidePanel.evaluate((element) => element.clientWidth)).toBe(targetWidth);
};

test.describe("PS-178 responsive Panel menus", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId, "pstdio-workbench"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("collapses each Panel at 480 px and restores only responsive collapses", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, storyId));
    await expect(panel(page, "main")).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });

    const mainPanel = panel(page, "main");
    await resizeViewportPanel(page, mainPanel, 481);
    await expect(menu(page, "main", "left")).toBeVisible();
    await expect(menu(page, "main", "right")).toBeVisible();
    await expect(menu(page, "secondary", "left")).toBeVisible();
    await expect(menu(page, "secondary", "right")).toBeVisible();

    await resizeViewportPanel(page, mainPanel, 480);
    for (const panelName of ["Main", "Secondary"] as const) {
      for (const side of ["left", "right"] as const) {
        await expect(trigger(page, panelName, side)).toBeVisible();
        await expect(menu(page, panelName.toLowerCase() as "main" | "secondary", side)).not.toBeVisible();
      }
    }

    await resizeViewportPanel(page, mainPanel, 481);
    await expect(menu(page, "main", "left")).toBeVisible();
    await expect(menu(page, "secondary", "right")).toBeVisible();

    const mainLeft = menu(page, "main", "left");
    const separator = page.getByRole("separator", { name: "Resize Main left menu" });
    const [menuBox, separatorBox] = await Promise.all([mainLeft.boundingBox(), separator.boundingBox()]);
    if (!menuBox || !separatorBox) throw new Error("Expected the Main menu resize geometry");
    const y = separatorBox.y + separatorBox.height / 2;
    await page.mouse.move(separatorBox.x + separatorBox.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(menuBox.x + 40, y);
    await page.mouse.up();
    await expect(trigger(page, "Main", "left")).toBeVisible();

    await resizeViewportPanel(page, mainPanel, 480);
    await resizeViewportPanel(page, mainPanel, 481);
    await expect(trigger(page, "Main", "left")).toBeVisible();
    await expect(menu(page, "main", "right")).toBeVisible();
  });

  test("collapses menus in a 420 px Side Panel and anchors its dropdown to the trigger", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, storyId));
    await expect(panel(page, "side")).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect.poll(() => panel(page, "side").evaluate((element) => element.clientWidth)).toBeGreaterThanOrEqual(400);
    await expect.poll(() => panel(page, "side").evaluate((element) => element.clientWidth)).toBeLessThanOrEqual(420);

    await expect(menu(page, "side", "left")).not.toBeVisible();
    await expect(menu(page, "side", "right")).not.toBeVisible();
    const openRight = trigger(page, "Side", "right");
    await openRight.focus();
    await page.keyboard.press("Enter");

    const controls = page.locator('[data-workbench-panel-menu-controls="side-right-menu"]');
    await expect(controls).toBeVisible();
    await expect(controls).toHaveCSS("box-shadow", "none");
    await expect(controls.getByRole("button", { name: "Attach Side right menu" })).toBeDisabled();
    await expect
      .poll(async () => {
        const [triggerBox, controlsBox] = await Promise.all([openRight.boundingBox(), controls.boundingBox()]);
        if (!triggerBox || !controlsBox) return Number.POSITIVE_INFINITY;
        return Math.abs(controlsBox.y - (triggerBox.y + triggerBox.height));
      })
      .toBeLessThanOrEqual(1);

    await page.keyboard.press("Escape");
    await expect(openRight).toBeFocused();
    await resizeSidePanel(page, 481);
    await expect(menu(page, "side", "left")).toBeVisible();
    await expect(menu(page, "side", "right")).toBeVisible();
    await expect(trigger(page, "Side", "right")).toHaveCount(0);
  });
});
