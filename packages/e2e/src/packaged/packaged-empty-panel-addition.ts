import { expect, type Page } from "@playwright/test";

export const verifyEmptyPanelAddition = async (page: Page) => {
  const side = page.locator('[data-workbench-panel-header="side"]');
  const bottom = page.locator('[data-workbench-panel-header="secondary"]');
  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  const showBottom = page.getByRole("button", { name: "Show Secondary Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  if (await showBottom.isVisible()) await showBottom.click();
  await expect(side).toBeVisible();
  const closeSelected = async (region: typeof side) => {
    await region.getByRole("tab", { selected: true }).focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  };
  await expect(side.getByRole("tab")).toHaveCount(0);
  await expect(bottom.getByRole("tab")).toHaveCount(0);
  await side.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
  await expect(side.getByRole("tab", { selected: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide Secondary Panel", exact: true })).toBeVisible();
  await expect(bottom.getByRole("tab")).toHaveCount(0);
  await closeSelected(side);
  await expect(side.getByRole("tab")).toHaveCount(0);
  await showSide.click();
  await bottom.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Session", exact: true }).click();
  await expect(bottom.getByRole("tab", { selected: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide Side Panel", exact: true })).toBeVisible();
  await expect(side.getByRole("tab")).toHaveCount(0);
};
