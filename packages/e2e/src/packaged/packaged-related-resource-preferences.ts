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

export const verifyBottomPageChoices = async (page: Page, terminalTab: Locator, reopen: Navigate, leave: Navigate) => {
  const sessionTab = page.getByRole("tab", { name: /Packaged created session/ });
  await tabAction(page, sessionTab, "Move to Secondary");
  await page.getByRole("button", { name: "Hide Secondary Panel", exact: true }).click();
  await reopen();
  await expect(terminalTab).toHaveAttribute("aria-selected", "true");
  await sessionTab.click();
  await leave();
  await terminalTab.click();
  await reopen();
  await expect(sessionTab).toHaveAttribute("aria-selected", "true");
  await expect(terminalTab).toHaveAttribute("aria-selected", "false");
  await page.getByRole("button", { name: "Hide Secondary Panel", exact: true }).click();
  await leave();
  await reopen();
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  await page.getByRole("button", { name: "Show Secondary Panel", exact: true }).click();
  await leave();
  await tabAction(page, sessionTab, "Move to Side");
};
