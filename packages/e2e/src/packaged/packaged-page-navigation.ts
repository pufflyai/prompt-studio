import type { Page } from "@playwright/test";

export const navigatePackagedPage = (page: Page, url: string) =>
  page.evaluate((href) => {
    window.history.pushState(null, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, url);
