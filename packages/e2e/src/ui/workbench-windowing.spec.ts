import type { ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import {
  STORY_RENDER_TIMEOUT_MS,
  startStorybook,
  stopStorybook,
  storyUrl,
  waitForStoryPlayback,
} from "./mermaid-renderer-storybook";

const storyIds = ["smoke", "webview", "boombox", "kiln"].map((name) => `pstdio-workbench-guides-windowing--${name}`);

test.describe("Workbench windowing stories", () => {
  let baseUrl = "";
  let storybook: ChildProcess | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(
      "pstdio-workbench-reference-core-api-visual-states--page-composition",
      "pstdio-workbench",
    ));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  for (const storyId of storyIds) {
    test(`${storyId} completes its interactions`, async ({ page, request }) => {
      const index = await request.get(`${baseUrl}/index.json`);
      expect(index.ok()).toBe(true);
      expect((await index.json()).entries[storyId]).toBeDefined();
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(storyUrl(baseUrl, storyId));
      await page
        .locator("#storybook-root > *")
        .first()
        .waitFor({ state: "attached", timeout: STORY_RENDER_TIMEOUT_MS });
      await waitForStoryPlayback(page);
      const outcome = await page.evaluate(() => {
        const channel = (
          window as unknown as { __STORYBOOK_ADDONS_CHANNEL__?: { last(event: string): unknown[] | undefined } }
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
      if (storyId.endsWith("--webview")) {
        const webview = page.frameLocator('iframe[title="Windowing webview"]');
        const draft = webview.getByRole("textbox", { name: "Webview draft" });
        const mount = await webview.getByLabel("Webview mount").textContent();
        await draft.fill("Retained iframe draft");
        await expect(draft).toHaveValue("Retained iframe draft");
        await expect(webview.getByLabel("Webview mount")).toHaveText(mount!);
      }
    });
  }
});
