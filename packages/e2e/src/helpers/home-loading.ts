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

export const verifyPageHeaderChoices = async (page: Page) => {
  const edge = page.getByLabel("Main header edge", { exact: true });
  const header = page.getByLabel("Main panel header", { exact: true });
  await edge.focus();
  await edge.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Show header", exact: true }).click();
  await header.focus();
  await header.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
  await expect(edge).toBeVisible();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(header).toBeVisible();
  await header.focus();
  await header.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
  await edge.focus();
  await edge.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Show header", exact: true }).click();
  await expect(header).toBeVisible();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("start-page")).toBeVisible();
  await expect(edge).toBeVisible();
  await page.reload();
  await expect(edge).toBeVisible();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(header).toBeVisible();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(edge).toBeVisible();
};

export const verifyFastHeaderNavigation = async (page: Page) => {
  const edge = page.getByLabel("Main header edge", { exact: true });
  const header = page.getByLabel("Main panel header", { exact: true });
  await edge.focus();
  await edge.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Show header", exact: true }).click();
  await header.focus();
  await header.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Hide header", exact: true }).click();
  await page.getByRole("option", { name: "Sessions", exact: true }).click();
  await expect(header).toBeVisible();
  await page.getByRole("button", { name: "Back to project", exact: true }).click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await expect(edge).toBeVisible();
};
