import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;

test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook("start-page-layout--default", "pstdio-dashboard"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

for (const story of ["default", "header-shown"]) {
  test(`Start page layout ${story}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `start-page-layout--${story}`));
    await waitForStoryPlayback(page);
    await expect(page.getByTestId("start-page")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Start", exact: true })).toHaveCount(0);
    await expect(
      page.getByLabel(story === "default" ? "Main header edge" : "Main panel header", { exact: true }),
    ).toBeVisible();
  });
}
