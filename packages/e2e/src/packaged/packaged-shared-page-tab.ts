import { expect, type Locator, type Page } from "@playwright/test";

export const verifySharedPageTab = async (
  page: Page,
  session: Locator,
  leaveWorkspace: () => Promise<unknown>,
  reopenWorkspace: () => Promise<unknown>,
) => {
  await leaveWorkspace();
  const sessionId = await session.locator("xpath=ancestor::*[@data-workbench-tab]").getAttribute("data-workbench-tab");
  const sessionTab = page.locator(`[data-workbench-tab=${JSON.stringify(sessionId)}]`).getByRole("tab");
  await session.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
  const main = page.locator('[data-workbench-panel-header="main"]');
  const workspace = main.getByRole("tab", { name: "Workspaces", exact: true });
  const id = await workspace.locator("xpath=ancestor::*[@data-workbench-tab]").getAttribute("data-workbench-tab");
  expect(id).toBeTruthy();
  await workspace.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  const shared = page.locator(`[data-workbench-tab=${JSON.stringify(id)}]`).getByRole("tab");
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: "Workspaces", exact: true }),
  ).toBeVisible();
  const start = new URL(page.url());
  start.pathname = `/projects/${start.pathname.split("/")[2]}/`;
  start.search = "";
  await page.evaluate((url) => {
    window.history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, start.href);
  await expect(shared).toBeVisible();
  await expect(sessionTab).toBeHidden();
  await shared.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  await expect(page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab")).toHaveCount(1);
  await page.reload();
  await expect(shared).toBeVisible();
  await page.goBack();
  await expect(shared).toBeVisible();
  await sessionTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Side", exact: true }).click();
  await shared.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to Main", exact: true }).click();
  await reopenWorkspace();
};
