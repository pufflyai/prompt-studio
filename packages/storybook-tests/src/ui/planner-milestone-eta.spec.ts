import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
const prefix = "extensions-planner-milestone-header--";

test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}forecast`, "pstdio-dashboard"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

for (const [story, label] of [
  ["forecast", "ETA ~8h"],
  ["filtered", "ETA ~6h"],
  ["remaining", "ETA ~6h"],
  ["completed-only", "Done"],
  ["unstarted", "ETA ~8h"],
  ["learning", "ETA —"],
  ["complete", "Done"],
]) {
  test(`milestone header shows ${story} estimate before progress`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    const estimate = page.getByLabel("Milestone estimate");
    await expect(estimate).toHaveText(label, { timeout: STORY_RENDER_TIMEOUT_MS });
    await waitForStoryPlayback(page);
    const bar = page.getByRole("progressbar", { name: "Milestone progress" });
    const estimateBox = await estimate.boundingBox();
    const barBox = await bar.boundingBox();
    expect(estimateBox!.x + estimateBox!.width).toBeLessThanOrEqual(barBox!.x);
    await estimate.focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.screenshot({ path: `/tmp/planner-eta-${story}.png` });
  });
}
