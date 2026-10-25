import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./storybook";

const storyId = "components-data-display-tree-list-measurement--hidden-and-shown";
const rowTops = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      { length: 12 },
      (_, index) =>
        document.querySelector(`[data-tree-list-focus-id="row-${index}"]`)?.getBoundingClientRect().top ?? null,
    ),
  );
// Resize observers report the hidden size before the second frame paints.
const nextFrames = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test.describe("virtual tree list", () => {
  let baseUrl = "";
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  // Retained workbench panels hide with display: none and keep their trees mounted.
  test("draws every row after its panel is hidden and shown again", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, storyId));
    await expect(page.getByText("Channel 12", { exact: true })).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    const shown = await rowTops(page);
    expect(shown.every((top) => top !== null)).toBe(true);

    await page.getByRole("button", { name: "Hide list" }).click();
    await expect(page.getByRole("listbox")).toBeHidden();
    await nextFrames(page);
    await page.getByRole("button", { name: "Show list" }).click();

    await expect.poll(() => rowTops(page)).toEqual(shown);
  });
});
