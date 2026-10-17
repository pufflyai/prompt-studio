import { expect, type Locator, type Page } from "@playwright/test";
import { verifyTabDropPinning } from "./packaged-tab-drop-pinning";

type Navigate = () => Promise<unknown>;
const tabAction = async (page: Page, tab: Locator, name: string) => {
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name, exact: true }).click();
};

export const verifyClosedSidePreference = async (page: Page, preview: Locator, leave: Navigate, reopen: Navigate) => {
  const side = page.locator('[data-workbench-panel="side"]:visible');
  const reset = async () => {
    const showBottom = page.getByRole("button", { name: "Show Secondary Panel", exact: true });
    if (await showBottom.isVisible()) await showBottom.click();
    await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
    await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
    const bottomTab = page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab").first();
    await tabAction(page, bottomTab, "Reset layout");
    await leave();
    await reopen();
    await expect(preview).toBeVisible();
  };
  await expect(side).toHaveCount(0);
  await page.reload();
  await expect(side).toHaveCount(0);
  await reset();
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await leave();
  await reopen();
  await expect(side).toHaveCount(0);
  await reset();
  await verifyTabDropPinning(page, preview);
};

export const verifyGlobalBottomState = async (page: Page, terminalTab: Locator, reopen: Navigate, leave: Navigate) => {
  await reopen();
  await expect(terminalTab).toBeVisible();
  await leave();
  await page.getByRole("button", { name: "Hide Secondary Panel", exact: true }).click();
  await reopen();
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  await page.getByRole("button", { name: "Show Secondary Panel", exact: true }).click();
  await expect(terminalTab).toBeVisible();
  await leave();
  await expect(terminalTab).toBeVisible();
};
