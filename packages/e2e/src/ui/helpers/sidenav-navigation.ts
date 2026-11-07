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

// Leaves the open Sidenav level: the breadcrumb's project button returns to the project start page.
export const openProjectHome = (page: Page, projectName: string) =>
  page
    .locator('[data-workbench-region="nav"]')
    .getByRole("button", { name: new RegExp(`${projectName}$`) })
    .click();

export const showSidenavEntry = async (page: Page, label: string) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await expect(option(sidenav, "Search")).toBeVisible();
  if (await revealTreeEntry(page, sidenav, option(sidenav, label))) return getSidenavEntry(page, label);
  await option(sidenav, "Search").click({ button: "right" });
  await expect(page.getByRole("menu").last()).toBeVisible();
  const visibilitySubmenu = page.getByRole("menuitem", { name: "Hide/show items", exact: true });
  if (await visibilitySubmenu.isVisible()) await visibilitySubmenu.hover();
  const visibilityItem = page.getByRole("menuitem", { name: label, exact: true });
  // The core Search row is ready before extension navigation. Wait for the
  // contribution before deciding whether its item needs to be shown.
  await expect(visibilityItem).toBeVisible();
  if (!(await option(sidenav, label).isVisible())) await visibilityItem.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  return getSidenavEntry(page, label);
};

// Navigation rows may be virtualized when extensions add more groups to the sidebar.
export const scrollSidenavToEnd = async (page: Page) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const lab = page.getByRole("option", { name: "Lab mode", exact: true });
  await expect.poll(() => revealTreeEntry(page, sidenav, lab)).toBe(true);
};
