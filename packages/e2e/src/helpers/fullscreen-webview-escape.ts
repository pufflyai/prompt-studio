import { expect, type Frame, type Page } from "@playwright/test";

export const verifyFullscreenWebviewEscape = async (page: Page, frame: Frame) => {
  await page.getByRole("button", { name: "Expand page" }).click();
  await frame.locator("body").hover({ position: { x: 1, y: 1 } });
  await expect(page.getByRole("tooltip")).toBeHidden();
  await frame.evaluate(() => {
    document.body.tabIndex = 0;
    document.body.focus();
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && Reflect.get(window, "consumeEscape")) event.preventDefault();
    });
    Reflect.set(window, "consumeEscape", true);
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  await frame.evaluate(() => Reflect.set(window, "consumeEscape", false));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Expand page" })).toBeVisible();
};
