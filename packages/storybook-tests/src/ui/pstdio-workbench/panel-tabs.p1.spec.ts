import { expect, test } from "@playwright/test";
import { getSharedStorybookBaseUrl } from "../../scripts/storybook-server";
import { waitForStoryPlayback } from "../storybook";

test("tab actions hand off dialogs and preserve focus after outside dismissal", async ({ page }) => {
  const baseUrl = getSharedStorybookBaseUrl("pstdio-workbench");
  await page.goto(`${baseUrl}/iframe.html?id=pstdio-workbench-guides-tab-actions--editable-title-and-bound-resource`);
  await waitForStoryPlayback(page);
  await expect(page.getByText("Deleted note-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Draft outside the menu" })).toBeFocused();
});
