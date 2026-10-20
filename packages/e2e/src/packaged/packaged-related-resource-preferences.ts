import { expect, type Locator, type Page } from "@playwright/test";
import { verifyTabDropPinning } from "./packaged-tab-drop-pinning";

type Navigate = () => Promise<unknown>;
const tabAction = async (page: Page, tab: Locator, name: string) => {
  await tab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name, exact: true }).click();
  const action = page.getByRole("menuitem", { name, exact: true, includeHidden: true });
  await expect(page.locator('[role="menu"]').filter({ has: action })).toHaveCount(0);
};

export const verifyClosedSidePreference = async (page: Page, preview: Locator, leave: Navigate, reopen: Navigate) => {
  const side = page.locator('[data-workbench-panel="side"]:visible');
  const revealPlacedPreview = async () => {
    await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
    await expect(preview).toBeVisible();
    await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  };
  const reset = async () => {
    const showBottom = page.getByRole("button", { name: "Show Bottom Panel", exact: true });
    if (await showBottom.isVisible()) await showBottom.click();
    await page.locator('[data-workbench-panel-header="secondary"]').getByRole("button", { name: "Add panel" }).click();
    await page.getByRole("menuitem", { name: "Terminal", exact: true }).click();
    const bottomTab = page.locator('[data-workbench-panel-header="secondary"]').getByRole("tab").first();
    await tabAction(page, bottomTab, "Reset page choices");
    await expect(bottomTab).toBeVisible();
    await leave();
    await reopen();
    await expect(preview).toBeVisible();
    await tabAction(page, bottomTab, "Reset panel layout");
    for (const name of ["Show Bottom Panel", "Show Side Panel"]) {
      const show = page.getByRole("button", { name, exact: true });
      if (await show.isVisible()) await show.click();
    }
    await expect(bottomTab).toBeVisible();
    await expect(preview).toBeVisible();
    await tabAction(page, bottomTab, "Close tab");
  };
  await expect(side).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Project folder");
  await expect(side).toHaveCount(0);
  await revealPlacedPreview();
  await reset();
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await leave();
  await reopen();
  await expect(side).toHaveCount(0);
  await revealPlacedPreview();
  await reset();
  await verifyTabDropPinning(page, preview);
};

export const verifyGlobalBottomState = async (page: Page, terminalTab: Locator, reopen: Navigate, leave: Navigate) => {
  await reopen();
  await expect(terminalTab).toBeVisible();
  await leave();
  await page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await reopen();
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  await expect(terminalTab).toBeVisible();
  await leave();
  await expect(terminalTab).toBeVisible();
};
