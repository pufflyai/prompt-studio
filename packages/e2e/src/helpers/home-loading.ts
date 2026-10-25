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
