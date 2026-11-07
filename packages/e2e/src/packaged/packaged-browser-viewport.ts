import type { Page } from "@playwright/test";

/** Restore the configured viewport after Chromium closes a temporary tab (ADR 0128). */
export const restorePackagedBrowserViewport = async (page: Page, viewport: { width: number; height: number }) => {
  await page.bringToFront();
  await page.setViewportSize({ ...viewport, height: viewport.height + 1 });
  await page.setViewportSize(viewport);
};
