import { expect, type Locator, type Page } from "@playwright/test";

const dragTab = async (page: Page, tab: Locator, target: Locator, region: "side" | "secondary") => {
  const start = (await tab.boundingBox())!;
  const end = (await target.boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 10, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
  await expect(page.locator(`[data-workbench-tab-drop="${region}"][data-drop-active]:visible`).first()).toBeVisible();
  await page.mouse.up();
};

export const verifyTabDropPinning = async (page: Page, preview: Locator) => {
  const bottomTabs = page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab");
  await expect(bottomTabs).toHaveCount(1);
  const original = await bottomTabs.first().textContent();
  await expect(preview).toHaveCSS("font-style", "italic");
  await dragTab(page, preview, bottomTabs.first(), "secondary");
  const moved = bottomTabs.filter({ hasText: "Packaged session actions" });
  await expect(bottomTabs).toHaveCount(2);
  await expect(bottomTabs.first()).toHaveText(original!);
  await expect(bottomTabs.first()).toHaveCSS("font-style", "italic");
  await expect(moved).toHaveCSS("font-style", "normal");
  await moved.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Unpin tab", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  await dragTab(page, moved, page.locator('[data-workbench-panel-header="side"]'), "side");
  await expect(preview).toBeVisible();
  await preview.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Unpin tab", exact: true }).click();
};
