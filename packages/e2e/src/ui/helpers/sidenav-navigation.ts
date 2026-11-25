import { expect, type Locator, type Page } from "@playwright/test";
import { revealTreeEntry } from "../../helpers/tree-entry";

const option = (sidenav: Locator, label: string) =>
  sidenav.getByRole("option", { name: new RegExp(`^${label}(?:\\s|$)`) }).first();

export const getSidenavEntry = async (page: Page, label: string) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const entry = option(sidenav, label);
  await revealTreeEntry(page, sidenav, entry);
  await expect(entry).toBeVisible();
  return entry;
};

export const leaveSidenavLevel = (page: Page) =>
  page
    .locator('[data-workbench-region="sidenav"]')
    .getByRole("button", { name: "Back to project", exact: true })
    .click();

export const showSidenavEntry = async (page: Page, label: string) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await expect(option(sidenav, "Search")).toBeVisible();
  if (await revealTreeEntry(page, sidenav, option(sidenav, label))) return getSidenavEntry(page, label);
  await option(sidenav, "Search").click({ button: "right" });
  await expect(page.getByRole("menu").last()).toBeVisible();
  await page.getByRole("menuitem", { name: "Hide/show items", exact: true }).click();
  const visibilityItem = page.getByRole("switch", { name: label, exact: true });
  // The core Search row is ready before extension navigation. Wait for the
  // contribution before deciding whether its item needs to be shown.
  await expect(visibilityItem).toBeVisible();
  if (!(await option(sidenav, label).isVisible())) await visibilityItem.click();
  await page.keyboard.press("Escape");
  return getSidenavEntry(page, label);
};
