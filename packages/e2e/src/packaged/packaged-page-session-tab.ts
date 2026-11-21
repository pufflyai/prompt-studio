import { expect, type Locator, type Page } from "@playwright/test";
import { navigatePackagedPage } from "./packaged-page-navigation";

export const verifyPageSessionTab = async (page: Page, sideTab: Locator) => {
  const workspaceUrl = page.url();
  const listUrl = new URL(workspaceUrl);
  listUrl.pathname = `/projects/${listUrl.pathname.split("/")[2]}/extensions/pstdio.workspaces/workspaces`;
  listUrl.search = "";
  const id = await sideTab.locator("xpath=ancestor::*[@data-workbench-tab]").getAttribute("data-workbench-tab");
  expect(id).toBeTruthy();
  const tab = page.locator(`[data-workbench-tab=${JSON.stringify(id)}]`).getByRole("tab");
  const header = page.locator('[data-workbench-panel-header="main"]');
  await expect(header.getByRole("tab", { name: "Files", exact: true })).toBeVisible();
  await sideTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
  await expect(page.locator('[data-workbench-panel-header="main"]').getByRole("tab", { selected: true })).toContainText(
    "Packaged created session",
  );
  await navigatePackagedPage(page, listUrl.href);
  await expect(tab).toHaveCount(0);
  await page.goBack();
  await expect(tab).toBeVisible();
  await header.getByRole("tab", { name: "Files", exact: true }).click();
  await expect(tab).toHaveAttribute("aria-selected", "false");
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Switch session", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  await expect(sideTab).toBeVisible();
  await navigatePackagedPage(page, workspaceUrl);
  await expect(header.getByRole("tab", { name: "Files", exact: true })).toBeVisible();
  await expect(header.getByRole("tab", { name: "Changes", exact: true })).toBeVisible();
};
