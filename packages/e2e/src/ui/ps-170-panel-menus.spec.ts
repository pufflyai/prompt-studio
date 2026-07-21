import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const sidePanelsStoryId = "pstdio-workbench-onboarding--side-panels";

interface MenuCase {
  panel: "Main" | "Secondary" | "Side";
  side: "left" | "right";
  contentRegion: "main" | "secondary" | "side";
}

const testedMenus: MenuCase[] = [
  { panel: "Main", side: "left", contentRegion: "main" },
  { panel: "Secondary", side: "right", contentRegion: "secondary" },
  { panel: "Side", side: "left", contentRegion: "side" },
];

const panelId = (panel: MenuCase["panel"]) => panel.toLowerCase();
const menuName = (entry: MenuCase) => `${entry.panel} ${entry.side} menu`;
const menuRegion = (page: Page, entry: MenuCase) =>
  page.locator(`[data-workbench-panel-menu="${panelId(entry.panel)}-${entry.side}"]`);

const dragMenuClosed = async (page: Page, menu: Locator, separator: Locator, side: MenuCase["side"]) => {
  const [menuBox, separatorBox] = await Promise.all([menu.boundingBox(), separator.boundingBox()]);
  expect(menuBox).not.toBeNull();
  expect(separatorBox).not.toBeNull();
  const startX = separatorBox!.x + separatorBox!.width / 2;
  const y = separatorBox!.y + separatorBox!.height / 2;
  const targetX = side === "left" ? menuBox!.x + 40 : menuBox!.x + menuBox!.width - 40;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(targetX, y);
  await page.mouse.up();
};

test.describe("PS-170 Panel-owned menus", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(sidePanelsStoryId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("shows all six headerless menus and reattaches one menu for every Panel type", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(storyUrl(baseUrl, sidePanelsStoryId));

    for (const panel of ["main", "secondary", "side"]) {
      for (const side of ["left", "right"]) {
        const menu = page.locator(`[data-workbench-panel-menu="${panel}-${side}"]`);
        await expect(menu).toBeVisible({ timeout: 30_000 });
        await expect(menu.locator("[data-workbench-panel-header]")).toHaveCount(0);
        await expect(menu.getByRole("button", { name: /^Close/ })).toHaveCount(0);
      }
    }

    await expect(page.locator('[data-workbench-panel-menu="main-right"]')).toContainText("Properties");
    await page.getByRole("button", { name: "Detach panel" }).click();
    const bubble = page.getByTestId("workbench-session-bubble");
    await expect(bubble).toBeVisible();
    await expect(bubble).not.toContainText("Properties");
    await expect(page.locator('[data-workbench-panel-menu="side-left"]')).not.toBeVisible();
    await expect(page.locator('[data-workbench-panel-menu="side-right"]')).not.toBeVisible();
    await bubble.getByRole("button", { name: "Attach panel" }).click();
    await expect(page.locator('[data-workbench-panel-menu="side-left"]')).toBeVisible();

    for (const entry of testedMenus) {
      const menu = menuRegion(page, entry);
      const contentNode = await page
        .locator(`[data-workbench-region="${entry.contentRegion}"]`)
        .first()
        .elementHandle();
      expect(contentNode).not.toBeNull();
      await dragMenuClosed(page, menu, page.getByRole("separator", { name: `Resize ${menuName(entry)}` }), entry.side);

      await expect(menu).not.toBeVisible();
      expect(await contentNode!.evaluate((element) => element.isConnected)).toBe(true);

      const header = page.locator(`[data-workbench-panel-header="${panelId(entry.panel)}"]`);
      const trigger = header.getByRole("button", { name: `Open ${menuName(entry)}` });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const controls = page.locator(
        `[data-workbench-panel-menu-controls="${panelId(entry.panel)}-${entry.side}-menu"]`,
      );
      await expect(controls).toBeVisible();
      await expect(controls).toHaveAttribute("role", "menu");
      await expect
        .poll(async () => {
          const [triggerBox, controlsBox] = await Promise.all([trigger.boundingBox(), controls.boundingBox()]);
          if (!triggerBox || !controlsBox) return Number.POSITIVE_INFINITY;
          return Math.abs(controlsBox.y - (triggerBox.y + triggerBox.height));
        })
        .toBeLessThanOrEqual(1);
      await expect(controls).toHaveCSS("box-shadow", "none");
      await expect(controls.getByText("Reattach", { exact: true })).toHaveCount(0);

      const attach = controls.getByRole("button", { name: `Attach ${menuName(entry)}` });
      await expect(attach).toHaveCount(1);
      await attach.click();
      await expect(menu).toBeVisible();
      await expect(trigger).toHaveCount(0);
      expect(await contentNode!.evaluate((element) => element.isConnected)).toBe(true);
    }
  });
});
