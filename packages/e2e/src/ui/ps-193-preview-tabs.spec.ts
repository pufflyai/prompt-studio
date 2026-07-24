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

  test("separates the active-tab custom menu from preview context actions", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, previewTabsStoryId));

    const sideHeader = page.locator('[data-workbench-panel-header="side"]');
    const tabs = sideHeader.getByRole("tab");
    await expect(tabs).toHaveCount(3, { timeout: 30_000 });
    await expect(tabs).toHaveText(["Session 42", "Files", "Terminal"]);

    const session = sideHeader.getByRole("tab", { name: "Session 42" });
    await expect(session).toHaveCSS("font-style", "italic");
    await expect(session).toHaveAttribute("aria-selected", "true");
    await session.click({ force: true });

    const customMenu = page.getByRole("menu", { name: "Session 42 menu" });
    await expect(customMenu.getByRole("menuitem", { name: "New session" })).toBeVisible();
    await expect(customMenu.getByRole("menuitem", { name: "Keep Open" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await session.click({ button: "right" });

    const contextMenu = page.getByRole("menu", { name: "Session 42 context menu" });
    const keepOpen = contextMenu.getByRole("menuitem", { name: "Keep Open" });
    await expect(keepOpen).toBeVisible();
    await expect(contextMenu.getByRole("menuitem", { name: "New session" })).toHaveCount(0);
    // The portaled menu can reposition while Storybook finishes compiling on constrained CI runners.
    await keepOpen.click({ force: true });
    await expect(session).toHaveCSS("font-style", "normal");

    const files = sideHeader.getByRole("tab", { name: "Files" });
    await files.focus();
    await files.press("Alt+ArrowRight");
    await expect(tabs).toHaveText(["Session 42", "Terminal", "Files"]);
  });
});
