import { expect, type Page } from "@playwright/test";

export const observeHomeLoading = async (page: Page) => {
  await page.addInitScript(() => {
    const observations = { defaultPlaceholderShown: false };
    Object.assign(window, { homeLoadingObservations: observations });
    new MutationObserver(() => {
      if (document.querySelector('[data-workbench-panel="main"] [aria-label="Available tabs"]')) {
        observations.defaultPlaceholderShown = true;
      }
    }).observe(document, { subtree: true, childList: true });
  });
};

export const expectNoDefaultHomePlaceholder = async (page: Page) => {
  const observations = await page.evaluate(
    () => Reflect.get(window, "homeLoadingObservations") as { defaultPlaceholderShown: boolean },
  );
  expect(observations.defaultPlaceholderShown).toBe(false);
};

export const verifyPageHeaders = async (page: Page) => {
  const header = page.getByLabel("Main panel header", { exact: true });
  await expect(header).toHaveCount(0);
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("New session");
  await expect(header).toHaveCount(0);
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("start-page")).toBeVisible();
  await expect(header).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("start-page")).toBeVisible();
  await expect(header).toHaveCount(0);
};
