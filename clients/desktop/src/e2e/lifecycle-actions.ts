import type { Page } from "@playwright/test";

export const acceptFocusedButton = async (page: Page) => {
  const closed = page.waitForEvent("close");
  await page.keyboard.press("Enter").catch((error) => {
    // The lifecycle view can close before the keyboard command returns.
    if (!page.isClosed()) throw error;
  });
  await closed;
};
