import { expect, type Locator, type Page } from "@playwright/test";

const option = (sidenav: Locator, label: string) =>
  sidenav.getByRole("option", { name: new RegExp(`^${label}(?:\\s|$)`) }).first();

export const getSidenavEntry = async (page: Page, label: string) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const entry = option(sidenav, label);
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
  if (await option(sidenav, label).isVisible()) return getSidenavEntry(page, label);
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
