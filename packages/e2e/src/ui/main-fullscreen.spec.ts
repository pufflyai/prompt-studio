import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const prefix = "pstdio-workbench-reference-core-api-main-fullscreen--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}attached-side`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

for (const story of ["attached-side", "floating-side", "closed-side", "fixed-side"]) {
  test(`fullscreen restores ${story} and retains live editors`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
    await expect(page.getByRole("textbox", { name: "Editor draft" })).toHaveValue("Unsaved Main draft");
    await page.getByRole("button", { name: "Enter Main fullscreen" }).click();
    await expect(page.locator('[data-workbench-region="status"]')).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Terminal draft" })).toBeHidden();
    if (story !== "fixed-side") {
      const toggle = page.getByRole("button", { name: "Show fullscreen Side Panel" });
      if (await toggle.isVisible()) await toggle.click();
      const session = page.getByRole("textbox", { name: "Session draft" });
      await session.fill("Live Side draft");
      await session.press("Escape");
      await expect(toggle).toBeFocused();
      await toggle.click();
      await expect(session).toHaveValue("Live Side draft");
      await session.press("Escape");
      await expect(toggle).toBeFocused();
    }
    await page.getByRole("textbox", { name: "Editor draft" }).press("Escape");
    await expect(page.getByRole("button", { name: "Enter Main fullscreen" })).toBeFocused();
    await expect(page.getByRole("textbox", { name: "Terminal draft" })).toBeVisible();
  });
}

for (const story of ["hidden-navigation", "page-and-mode-continuity"]) {
  test(`fullscreen ${story}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
    await expect(page.getByRole("button", { name: "Enter Main fullscreen" })).toBeVisible();
  });
}

test("unhandled iframe Escape dismisses Side then exits, preserving guest drafts", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-main-fullscreen-iframe--guest-keyboard"));
  const main = page.frameLocator('iframe[title="Editor extension"]');
  await main.getByRole("textbox", { name: "Guest draft" }).fill("Unsaved iframe Main");
  await page.getByRole("button", { name: "Enter Main fullscreen" }).click();
  const side = page.frameLocator('iframe[title="Session extension"]');
  const draft = side.getByRole("textbox", { name: "Guest draft" });
  await draft.fill("Unsaved iframe Side");
  await side.getByRole("button", { name: "Open nested dialog" }).click();
  await side.getByRole("dialog").press("Escape");
  await expect(page.getByRole("button", { name: "Hide fullscreen Side Panel" })).toBeVisible();
  await draft.press("Escape");
  const reopen = page.getByRole("button", { name: "Show fullscreen Side Panel" });
  await expect(reopen).toBeFocused();
  await reopen.click();
  await expect(draft).toHaveValue("Unsaved iframe Side");
  await draft.press("Escape");
  await expect(reopen).toBeFocused();
  await main.getByRole("textbox", { name: "Guest draft" }).press("Escape");
  await expect(page.getByRole("button", { name: "Enter Main fullscreen" })).toBeFocused();
  await expect(main.getByRole("textbox", { name: "Guest draft" })).toHaveValue("Unsaved iframe Main");
});
