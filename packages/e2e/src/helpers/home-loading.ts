import { expect, type Page } from "@playwright/test";

export const homeFrame = (page: Page) => page.frameLocator('iframe[title="Home"]');
export const homePage = (page: Page) => homeFrame(page).getByTestId("start-page");

export const verifyPageHeaders = async (page: Page) => {
  const header = page.getByLabel("Main panel header", { exact: true });
  await expect(header).toHaveCount(0);
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("New session");
  await expect(header).toHaveCount(0);
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(homePage(page)).toBeVisible();
  await expect(header).toHaveCount(0);
  await page.reload();
  await expect(homePage(page)).toBeVisible();
  await expect(header).toHaveCount(0);
};
