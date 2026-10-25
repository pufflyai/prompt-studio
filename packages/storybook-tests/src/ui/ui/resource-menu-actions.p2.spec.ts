import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "../storybook";

const prefix = "components-overlays-resource-context-menu--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}selection-action`, "ui"));
});
test.afterAll(async () => stopStorybook(storybook));

for (const story of ["selection-action", "inline-action"]) {
  test(`resource menu action timing: ${story}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
  });
}
