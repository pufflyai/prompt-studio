import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "../storybook";

const prefix = "pstdio-workbench-reference-core-api-main-fullscreen--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}attached-side`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

for (const story of ["attached-side", "floating-side", "closed-side", "fixed-side", "rearranged-panels"]) {
  test(`fullscreen restores ${story} and retains live editors`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
    await expect(page.getByRole("textbox", { name: "Editor draft" })).toHaveValue("Unsaved Main draft");
    if (story === "rearranged-panels") {
      const main = (await page.getByRole("textbox", { name: "Editor draft" }).boundingBox())!;
      const side = (await page.getByRole("textbox", { name: "Session draft" }).boundingBox())!;
      const bottom = (await page.getByRole("textbox", { name: "Terminal draft" }).boundingBox())!;
      expect(side.x).toBeLessThan(main.x);
      expect(bottom.y).toBeLessThan(main.y);
    }
    await page.getByRole("button", { name: "Enter Main fullscreen" }).click();
    await expect(page.locator('[data-workbench-region="status"]')).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Terminal draft" })).toBeHidden();
    if (story !== "fixed-side") {
      const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
      if (await bubble.isVisible()) await bubble.click();
      const session = page.getByRole("textbox", { name: "Session draft" });
      // Editing moves the pointer off controls whose tooltips handle Escape.
      await session.click();
      await session.fill("Live Side draft");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await session.press("Escape");
      await expect(bubble).toBeFocused();
      await bubble.click();
      await expect(session).toHaveValue("Live Side draft");
      await session.click();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await session.press("Escape");
      await expect(bubble).toBeFocused();
    }
    await page.getByRole("textbox", { name: "Editor draft" }).press("Escape");
    await expect(page.getByRole("button", { name: "Enter Main fullscreen" })).toBeFocused();
    await expect(page.getByRole("textbox", { name: "Terminal draft" })).toBeVisible();
    if (story === "rearranged-panels") {
      const main = (await page.getByRole("textbox", { name: "Editor draft" }).boundingBox())!;
      const side = (await page.getByRole("textbox", { name: "Session draft" }).boundingBox())!;
      const bottom = (await page.getByRole("textbox", { name: "Terminal draft" }).boundingBox())!;
      expect(side.x).toBeLessThan(main.x);
      expect(bottom.y).toBeLessThan(main.y);
    }
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
  await expect(page.getByRole("dialog", { name: "Side Panel", exact: true })).toBeVisible();
  await draft.press("Escape");
  const reopen = page.getByRole("button", { name: "Open Side Panel", exact: true });
  await expect(reopen).toBeFocused();
  await reopen.click();
  await expect(draft).toHaveValue("Unsaved iframe Side");
  await draft.press("Escape");
  await expect(reopen).toBeFocused();
  await main.getByRole("textbox", { name: "Guest draft" }).press("Escape");
  await expect(page.getByRole("button", { name: "Enter Main fullscreen" })).toBeFocused();
  await expect(main.getByRole("textbox", { name: "Guest draft" })).toHaveValue("Unsaved iframe Main");
});
