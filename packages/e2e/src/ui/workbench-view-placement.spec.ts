import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const storyId = "pstdio-workbench-guides-panels-and-pages--resource-tabs";

test.describe("Workbench View placements", () => {
  let baseUrl = "";
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(storyId, "pstdio-workbench"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("replaces previews, pins an instance, and reuses its resource tab", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, storyId));

    const secondaryHeader = page.locator('[data-workbench-panel-header="secondary"]');
    const tabs = secondaryHeader.getByRole("tab");
    await page.getByRole("button", { name: "Preview Alpha" }).click();
    const alpha = secondaryHeader.getByRole("tab", { name: "Alpha.md" });
    await expect(alpha).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect(alpha).toHaveCSS("font-style", "italic");

    await page.getByRole("button", { name: "Preview Beta" }).click();
    const beta = secondaryHeader.getByRole("tab", { name: "Beta.md" });
    await expect(alpha).toHaveCount(0);
    await expect(beta).toHaveCSS("font-style", "italic");

    await page.getByRole("button", { name: "Pin Beta" }).click();
    await expect(beta).toHaveCSS("font-style", "normal");
    await page.getByRole("button", { name: "Preview Alpha" }).click();
    await expect(tabs).toHaveCount(2);

    await page.getByRole("button", { name: "Preview Beta" }).click();
    await expect(tabs).toHaveCount(2);
    await expect(beta).toHaveAttribute("aria-selected", "true");
  });
});
