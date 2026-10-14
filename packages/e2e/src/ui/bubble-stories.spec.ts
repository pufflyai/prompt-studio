import type { ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const storyIds = ["top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"].map(
  (anchor) => `components-overlays-bubble-anchors--${anchor}`,
);
storyIds.push("components-overlays-bubble-motion--launcher-and-panel");

test.describe("Floating bubble stories", () => {
  let baseUrl = "";
  let storybook: ChildProcess | undefined;
  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyIds[0]!));
  });
  test.afterAll(async () => {
    await stopStorybook(storybook);
  });
  for (const storyId of storyIds)
    test(`${storyId} completes its interactions`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(storyUrl(baseUrl, storyId));
      await waitForStoryPlayback(page);
      const result = await page.evaluate(
        () =>
          (
            window as unknown as {
              __STORYBOOK_ADDONS_CHANNEL__?: { last(event: string): unknown[] | undefined };
            }
          ).__STORYBOOK_ADDONS_CHANNEL__?.last("storyFinished")?.[0],
      );
      expect(result).toMatchObject({ storyId, status: "success" });
    });
});
