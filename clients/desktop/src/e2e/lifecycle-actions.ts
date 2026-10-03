import type { Page } from "@playwright/test";

export const allowPageClose = async (page: Page, action: () => Promise<unknown>) => {
  await action().catch((error) => {
    // A Quit action can destroy the renderer before CDP returns its response.
    if (
      !page.isClosed() ||
      !(error instanceof Error) ||
      !error.message.includes("Target page, context or browser has been closed")
    )
      throw error;
  });
};

export const acceptFocusedButton = async (page: Page) => {
  await allowPageClose(page, () => page.keyboard.press("Enter"));
};
