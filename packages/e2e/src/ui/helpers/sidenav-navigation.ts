import { expect, type Locator, type Page } from "@playwright/test";

const option = (sidenav: Locator, label: string) =>
  sidenav.getByRole("option", { name: new RegExp(`^${label}(?:\\s|$)`) }).first();

export const showHiddenSidenavEntry = async (page: Page, label: string) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  const entry = option(sidenav, label);
  if (await entry.count()) return entry;

  const search = option(sidenav, "Search");
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.click({ button: "right" });
  await page
    .locator('[role="menuitem"][data-value^="node:"]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .click();
  await expect(entry).toBeVisible();
  await page.keyboard.press("Escape");
  return entry;
};
