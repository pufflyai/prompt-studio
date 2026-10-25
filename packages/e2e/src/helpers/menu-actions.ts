import type { Page } from "@playwright/test";

export const selectMenuAction = async (page: Page, action: string) => {
  const menu = page.getByRole("menu");
  // Track this popup after closing removes it from the accessibility tree.
  const closing = (await menu.elementHandle())!;
  try {
    await menu.getByRole("menuitem", { name: action, exact: true }).click();
    await closing.waitForElementState("hidden");
  } finally {
    await closing.dispose();
  }
};
