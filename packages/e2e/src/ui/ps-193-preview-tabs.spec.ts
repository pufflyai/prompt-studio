import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, storyUrl } from "./mermaid-renderer-storybook";

const previewTabsStoryId = "pstdio-workbench-examples--preview-tabs";

test.describe("PS-193 preview tabs", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(previewTabsStoryId, "pstdio-workbench"));
  });

  test.afterAll(() => {
    storybook?.kill();
  });

  test("promotes the leftmost preview and keyboard-reorders persistent tabs", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, previewTabsStoryId));

    const sideHeader = page.locator('[data-workbench-panel-header="side"]');
    const tabs = sideHeader.getByRole("tab");
    await expect(tabs).toHaveCount(3, { timeout: 30_000 });
    await expect(tabs).toHaveText(["Session 42", "Files", "Terminal"]);

    const session = sideHeader.getByRole("tab", { name: "Session 42" });
    await expect(session).toHaveCSS("font-style", "italic");
    await session.click({ button: "right" });

    const actions = page.getByRole("menu", { name: "Session 42 actions" });
    const keepOpen = actions.getByRole("menuitem", { name: "Keep Open" });
    await expect(keepOpen).toBeVisible();
    await keepOpen.click();
    await expect(session).toHaveCSS("font-style", "normal");

    const files = sideHeader.getByRole("tab", { name: "Files" });
    await files.focus();
    await files.press("Alt+ArrowRight");
    await expect(tabs).toHaveText(["Session 42", "Terminal", "Files"]);
  });
});
