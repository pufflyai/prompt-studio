import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

test("lazy resource lists preserve rows on page failure, retry, and cancel obsolete searches", async ({ page }) => {
  const story = "overlays-resourcemenulist--loading-retry-and-cancellation";
  const { baseUrl } = await startStorybook(story);
  await page.goto(storyUrl(baseUrl, story));
  await expect(page.getByText("Session list target", { exact: true })).toBeVisible();
  await waitForStoryPlayback(page);
});
