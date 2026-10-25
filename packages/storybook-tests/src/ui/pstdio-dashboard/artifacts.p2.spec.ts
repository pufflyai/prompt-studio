import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl } from "../storybook";

test.use({ colorScheme: null });
test("loads a thumbnail while command completion refreshes host props", async ({ page }) => {
  const storyId = "extensions-artifacts-library--host-updates";
  const { baseUrl, storybook } = await startStorybook(storyId, "pstdio-dashboard");
  try {
    await page.goto(storyUrl(baseUrl, storyId));
    const card = page.getByRole("button", { name: "Release overview", exact: true });
    await card.scrollIntoViewIfNeeded();
    await expect(card.frameLocator("iframe").frameLocator("iframe").locator("h1")).toHaveText("Saved preview");
  } finally {
    await stopStorybook(storybook);
  }
});

test("uses translated version controls", async ({ page }) => {
  const storyId = "extensions-artifacts-library--french";
  const { baseUrl, storybook } = await startStorybook(storyId, "pstdio-dashboard");
  try {
    await page.goto(storyUrl(baseUrl, storyId));
    await expect(page.getByRole("button", { name: "Release overview", exact: true })).toBeVisible();
    await page.goto(storyUrl(baseUrl, "extensions-artifacts-reader--french"));
    const versions = page.getByRole("button", { name: "Versions", exact: true });
    await versions.click();
    await expect(page.getByRole("menuitemradio", { name: "Version 1 · Dernière version" })).toBeVisible();
    await page.keyboard.press("Escape");
  } finally {
    await stopStorybook(storybook);
  }
});
