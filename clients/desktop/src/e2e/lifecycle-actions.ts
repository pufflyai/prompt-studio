import type { Page } from "@playwright/test";

export const acceptFocusedButton = async (page: Page) => {
  await page.keyboard.press("Enter").catch((error) => {
    // Quitting the app can close the page before the keyboard command returns.
    if (!page.isClosed()) throw error;
  });
};
