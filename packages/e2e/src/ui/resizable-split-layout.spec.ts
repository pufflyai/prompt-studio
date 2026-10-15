import type { ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  STORY_RENDER_TIMEOUT_MS,
  startStorybook,
  stopStorybook,
  storyUrl,
  waitForStoryPlayback,
} from "./mermaid-renderer-storybook";

test.describe("Resizable split layout stories", () => {
  let baseUrl = "";
  let storybook: ChildProcess | undefined;
  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook("components-layout-resizable-split-layout-closing--right"));
  });
  test.afterAll(async () => {
    await stopStorybook(storybook);
  });
  for (const name of ["right", "left", "bottom", "top", "cannot-close"]) {
    const storyId = `components-layout-resizable-split-layout-closing--${name}`;
    test(`${name} completes its closing interactions`, async ({ page }) => {
      await page.goto(storyUrl(baseUrl, storyId));
      await page
        .locator("#storybook-root > *")
        .first()
        .waitFor({ state: "attached", timeout: STORY_RENDER_TIMEOUT_MS });
      await waitForStoryPlayback(page);
      const outcome = await page.evaluate(() => {
        const channel = (
          window as unknown as {
            __STORYBOOK_ADDONS_CHANNEL__?: { last(event: string): unknown[] | undefined };
          }
        ).__STORYBOOK_ADDONS_CHANNEL__;
        return {
          result: channel?.last("storyFinished")?.[0],
          errors: [
            "storyErrored",
            "storyThrewException",
            "playFunctionThrewException",
            "unhandledErrorsWhilePlaying",
          ].flatMap((event) => channel?.last(event) ?? []),
        };
      });
      expect(outcome.errors).toEqual([]);
      expect(outcome.result).toMatchObject({ storyId, status: "success" });
    });
  }
});
