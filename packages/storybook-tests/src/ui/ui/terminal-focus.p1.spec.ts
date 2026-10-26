import { expect, test } from "@playwright/test";
import { getSharedStorybookBaseUrl } from "../../scripts/storybook-server";
import { storyUrl, waitForStoryPlayback } from "../storybook";

test("a terminal opened from a menu keeps focus when the menu returns focus to its trigger", async ({ page }) => {
  const baseUrl = getSharedStorybookBaseUrl("ui")!;
  await page.goto(storyUrl(baseUrl, "components-terminal--deferred-focus-ignores-popup-restore"));
  await waitForStoryPlayback(page);
  await page.getByRole("menuitem", { name: "Open terminal" }).click();
  await expect(page.locator(".xterm-rows")).toContainText("Opened from a menu");
  await expect(page.getByRole("textbox", { name: "Terminal input" })).toBeFocused();
});

test("a terminal does not take focus from a control focused after it asked for focus", async ({ page }) => {
  const baseUrl = getSharedStorybookBaseUrl("ui")!;
  await page.goto(storyUrl(baseUrl, "components-terminal--deferred-focus-respects-new-choice"));
  await waitForStoryPlayback(page);
  await expect(page.locator(".xterm-rows")).toContainText("Focus fixture ready");
  await expect(page.getByRole("textbox", { name: "Next control" })).toBeFocused();
  await page.getByRole("button", { name: "Open another terminal" }).click();
  await expect(page.getByRole("textbox", { name: "Terminal input" })).toBeFocused();
});
