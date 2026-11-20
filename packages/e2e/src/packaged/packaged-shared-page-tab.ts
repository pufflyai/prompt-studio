import { expect, type Locator, type Page } from "@playwright/test";
import { navigatePackagedPage } from "./packaged-page-navigation";

export const verifySharedPageTab = async (page: Page, session: Locator, leaveWorkspace: () => Promise<unknown>) => {
  const workspaceUrl = page.url();
  await leaveWorkspace();
  await expect(page).toHaveURL(/\/extensions\/pstdio\.workspaces\/workspaces(?:\?|$)/);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Workspaces");
  const main = page.locator('[data-workbench-panel-header="main"]');
  await main.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  const workspace = page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: "Workspaces", exact: true });
  await expect(workspace).toBeVisible();
  const id = await workspace.locator("xpath=ancestor::*[@data-workbench-tab]").getAttribute("data-workbench-tab");
  expect(id).toBeTruthy();
  const shared = page.locator(`[data-workbench-tab=${JSON.stringify(id)}]`).getByRole("tab");
  await expect(shared).toBeVisible();
  await expect(session).toBeVisible();
  await shared.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  await expect(page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab")).toHaveCount(1);
  await page.reload();
  await expect(
    page
      .locator('[data-workbench-panel-header="secondary"]')
      .locator(`[data-workbench-tab=${JSON.stringify(id)}]`)
      .getByRole("tab"),
  ).toBeVisible();
  await navigatePackagedPage(page, workspaceUrl);
  await expect(shared).toBeVisible();
  // Explicitly reopening this page reclaims its singleton into tabless Main.
  await leaveWorkspace();
  await expect(shared).toHaveCount(0);
  await expect(main.getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Workspaces");
  await navigatePackagedPage(page, workspaceUrl);
  await expect(session).toBeVisible();
};
