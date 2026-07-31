import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { STORY_RENDER_TIMEOUT_MS, startStorybook, stopStorybook, storyUrl } from "./mermaid-renderer-storybook";

const floatingStoryId = "pstdio-workbench-onboarding--floating-side-panel";
const launcherStoryId = "pstdio-workbench-onboarding--side-panel-launcher";

test.describe("PS-176 floating Side Panel", () => {
  test.slow();

  let baseUrl: string;
  let storybook: ChildProcessWithoutNullStreams | undefined;

  test.beforeAll(async () => {
    ({ baseUrl, storybook } = await startStorybook(floatingStoryId, "pstdio-workbench"));
  });

  test.afterAll(async () => {
    await stopStorybook(storybook);
  });

  test("moves one live multi-tab Side Panel between floating and attached presentations", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, floatingStoryId));

    const floating = page.getByTestId("workbench-side-panel-floating");
    await expect(floating).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect(floating.getByRole("tab", { name: /Session A/ })).toBeVisible();
    await expect(floating.getByRole("tab", { name: /Checks 3/ })).toBeVisible();
    await expect.poll(() => floating.getByRole("tab").count()).toBeGreaterThanOrEqual(3);
    await expect(floating).toHaveCSS("box-shadow", "none");

    const viewport = page.viewportSize();
    const floatingBox = await floating.boundingBox();
    expect(viewport).not.toBeNull();
    expect(floatingBox).not.toBeNull();
    expect(viewport!.width - (floatingBox!.x + floatingBox!.width)).toBeLessThanOrEqual(16);
    expect(viewport!.height - (floatingBox!.y + floatingBox!.height)).toBeLessThanOrEqual(16);

    const sideRegion = await floating.getByRole("region", { name: "Side Panel" }).elementHandle();
    expect(sideRegion).not.toBeNull();

    const sessionTab = floating.getByRole("tab", { name: /Session A/ });
    await sessionTab.click();
    await sessionTab.click();
    const sessionMenu = page.getByRole("menu", { name: "Session A menu" });
    await expect(sessionMenu.getByRole("menuitem", { name: "New session" })).toBeVisible();
    await expect(sessionMenu.getByRole("menuitem", { name: "Session B" })).toBeVisible();
    await page.keyboard.press("Escape");

    await floating.getByRole("tab", { name: "Inspector" }).click();
    const selectedResource = floating.getByText("onboarding.side-panels.item:design-brief", { exact: true });
    await expect(selectedResource).toBeVisible();

    await floating.getByRole("button", { name: "Reattach Side Panel" }).click();
    const attached = page.getByTestId("workbench-side-panel-attached");
    await expect(attached).toBeVisible();
    await expect(floating).toHaveCount(0);
    await expect(attached.getByText("onboarding.side-panels.item:design-brief", { exact: true })).toBeVisible();
    expect(
      await attached
        .getByRole("region", { name: "Side Panel" })
        .evaluate((node, original) => node === original, sideRegion),
    ).toBe(true);

    await attached.getByRole("button", { name: "Float Side Panel" }).click();
    await expect(floating).toBeVisible();
    await expect(selectedResource).toBeVisible();
    expect(
      await floating
        .getByRole("region", { name: "Side Panel" })
        .evaluate((node, original) => node === original, sideRegion),
    ).toBe(true);
  });

  test("keeps the no-session launcher available without workspace setup", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(storyUrl(baseUrl, launcherStoryId));

    const launcher = page.getByRole("button", { name: "Open Side Panel" });
    await expect(launcher).toBeVisible({ timeout: STORY_RENDER_TIMEOUT_MS });
    await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);

    await launcher.click();
    const floating = page.getByTestId("workbench-side-panel-floating");
    await expect(floating).toBeVisible();
    await expect(floating.getByRole("tab", { name: /Session A/ })).toHaveCount(0);

    await floating.getByRole("button", { name: "Close Side Panel" }).click();
    await expect(launcher).toBeVisible();
  });
});
