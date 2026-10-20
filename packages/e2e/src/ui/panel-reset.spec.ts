import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const prefix = "pstdio-workbench-reference-core-api-panel-reset--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}page-choices`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

for (const story of ["page-choices", "panel-layout"]) {
  test(`${story} preserves an edited moved resource`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
    await expect(page.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Unsaved work");
    await expect(page.getByRole("tab", { name: "Draft", exact: true })).toHaveCount(1);
  });
}
