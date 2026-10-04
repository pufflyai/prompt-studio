import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const storyId = "components-data-display-data-table--search-cell-values";
let baseUrl = "";
let storybook: ChildProcessWithoutNullStreams | undefined;

test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(storyId));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

test("search matches and highlights displayed labels, relative dates, and diff counts", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, storyId));
  await waitForStoryPlayback(page);
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Search this view", exact: true }).click();
  const search = page.getByRole("textbox", { name: "Search this view", exact: true });
  const rows = page.locator("tbody tr").filter({ has: page.locator('td[data-column-id="Name"]') });
  for (const text of ["Completed", "5 hours ago", "+128", "-14"]) {
    await search.fill(text);
    await expect(rows).toHaveCount(1);
    await expect(page.locator("mark")).toHaveText(text);
  }
  await search.press("Escape");
  await expect(rows).toHaveCount(2);
});
