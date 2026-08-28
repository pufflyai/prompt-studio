import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const storyId = "patterns-kanban-renderer-collection-badge-list--linked-resources";

test.describe("collection badge list", () => {
  test.slow();
  let baseUrl = "";
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("opens every linked resource with pointer and keyboard input", async ({ page }) => {
    await page.goto(storyUrl(baseUrl, storyId));
    const ada = page.getByRole("button", { name: "Ada", exact: true });
    const lee = page.getByRole("button", { name: "Lee", exact: true });
    await expect(ada).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect(lee).toBeVisible();

    await ada.click();
    await expect(page.getByTestId("opened-resource")).toHaveText("ada");

    await lee.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("opened-resource")).toHaveText("lee");
  });
});
