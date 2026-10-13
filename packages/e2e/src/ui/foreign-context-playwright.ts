import { expect, type Page } from "@playwright/test";
export const exerciseForeignContext = async (page: Page) => {
  await page.getByRole("button", { name: "Session 2", exact: true }).click();
  const foreign = page.getByRole("tab", { name: "Session 2 · Outside this workspace · Project", exact: true });
  const tooltip = page.getByRole("tooltip", { name: "Outside this workspace · Project", exact: true });
  await page.mouse.move(0, 0);
  await foreign.hover();
  await expect(tooltip).toBeVisible();
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Grow Secondary", exact: true }).click();
  await expect(tooltip).not.toBeVisible();
  await foreign.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(foreign).toBeFocused();
  await expect(tooltip).toBeVisible();
};
