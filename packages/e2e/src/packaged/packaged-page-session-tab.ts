import { expect, type Locator, type Page } from "@playwright/test";

export const verifyPageSessionTab = async (
  page: Page,
  sideTab: Locator,
  leavePage: () => Promise<unknown>,
  returnToPage: () => Promise<unknown>,
) => {
  const id = await sideTab.locator("xpath=ancestor::*[@data-workbench-tab]").getAttribute("data-workbench-tab");
  expect(id).toBeTruthy();
  const tab = page.locator(`[data-workbench-tab=${JSON.stringify(id)}]`).getByRole("tab");
  await sideTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
  await expect(page.locator('[data-workbench-panel-header="main"]').getByRole("tab", { selected: true })).toContainText(
    "Packaged created session",
  );
  await leavePage();
  await expect(tab).toHaveCount(0);
  await returnToPage();
  await expect(tab).toBeVisible();
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Switch session", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  await expect(sideTab).toBeVisible();
};
