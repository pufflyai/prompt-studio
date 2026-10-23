import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const prefix = "pstdio-workbench-guides-fixed-mode-return--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}project`, "pstdio-workbench"));
});
test.afterAll(async () => stopStorybook(storybook));

for (const story of ["project", "renamed-mode", "without-header-items"]) {
  test(`Back to mode navigation: ${story}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
  });
}

test("returning to the project keeps navigation rows stable", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-guides-navigation-chrome-continuity--return-to-project"));
  await waitForStoryPlayback(page);
});
