import { expect, type Page } from "@playwright/test";

export const changeThemeThroughCommandPalette = async (page: Page) => {
  await page.mouse.move(0, 0);
  await page.keyboard.press("Alt+Shift+K");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("textbox").fill(">Run Command");
  await palette.getByRole("option", { name: /Run Command/ }).click();
  await expect(palette.getByRole("textbox")).toHaveValue("> ");
  await palette.getByRole("textbox").fill(">Choose color theme");
  await palette.getByRole("option", { name: /Choose color theme/ }).click();

  await expect(palette.getByPlaceholder("Search themes")).toBeVisible();
  await palette.getByRole("option", { name: "Prompt Light", exact: true }).click();
  await expect(palette).not.toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pstdio-light");
  expect(await page.evaluate(() => localStorage.getItem("theme-preference"))).toBe("pstdio-light");

  await page.reload();
  await expect(page.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pstdio-light");
};
