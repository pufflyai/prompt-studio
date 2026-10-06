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
