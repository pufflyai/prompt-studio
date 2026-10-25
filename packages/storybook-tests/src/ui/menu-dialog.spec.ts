import { expect, test } from "@playwright/test";
import { getSharedStorybookBaseUrl } from "../scripts/storybook-server";
import { storyUrl, waitForStoryPlayback } from "./storybook";

test("a portalled menu accepts pointer and keyboard input above its dialog", async ({ page }) => {
  const baseUrl = getSharedStorybookBaseUrl("ui")!;
  await page.goto(storyUrl(baseUrl, "components-navigation-searchable-menu--portalled-inside-dialog"));
  await waitForStoryPlayback(page);
  const search = page.getByRole("textbox", { name: "Search workspaces..." });
  await search.click();
  await search.pressSequentially("origin/main");
  await expect(page.getByRole("menuitem", { name: "main", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "feature/searchable-menu-1", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "main", exact: true }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Create workspace" })).toBeVisible();

  await page.goto(storyUrl(baseUrl, "components-navigation-searchable-menu--branch-selector"));
  await waitForStoryPlayback(page);
  await page.getByRole("menuitem", { name: "main", exact: true }).click();
  await expect(page.getByRole("menu")).toBeHidden();
});
