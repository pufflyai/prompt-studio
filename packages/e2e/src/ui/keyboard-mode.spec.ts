import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
const prefix = "pstdio-workbench-reference-keyboard--";
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}visible-panels`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

test("fast entry owns keys, global navigation stays active and exits into Secondary", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  const draft = page.getByRole("textbox", { name: "Draft 4", exact: true });
  await draft.fill("Unsaved Secondary");
  await draft.press("Alt+Shift+Space");
  await page.keyboard.press("v");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog", { name: "Keyboard menu / V", exact: true })).toBeVisible();
  await expect(draft).toHaveValue("Unsaved Secondary");
  await page.keyboard.press("Alt+Shift+4");
  await expect(page.getByRole("dialog", { name: "Keyboard menu / V", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "PS-4", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(draft).toBeFocused();
  await expect(page.locator("[data-keyboard-tab-number]")).toHaveCount(0);
});

test("ambiguous visible resources require a choice and Enter on the heading is inert", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("a");
  await page.keyboard.press("s");
  const selector = page.getByRole("dialog", { name: "Change ticket status", exact: true });
  await expect(selector).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(selector).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(selector).toBeHidden();
});

test("tabs beyond nine use the picker and repeated arrows wrap", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}crowded-tabs`));
  await waitForStoryPlayback(page);
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("v");
  await expect
    .poll(() =>
      page.locator('[role="tablist"]').evaluateAll((strips) => {
        const first = [...strips].sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top ||
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0];
        return first?.querySelector("[data-keyboard-tab-number]")?.textContent;
      }),
    )
    .toBe("1");
  const firstLabelId = await page
    .locator("[data-keyboard-tab-number]")
    .filter({ hasText: /^1$/ })
    .locator('xpath=ancestor::*[@role="tab"]')
    .getAttribute("aria-labelledby");
  const firstLabel = await page.locator(`[id="${firstLabelId}"]`).textContent();
  await page.keyboard.press("t");
  const picker = page.getByRole("dialog", { name: "Select tab", exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByText(/^10 ·/)).toBeVisible();
  await page.keyboard.press("1");
  await expect(picker).toBeHidden();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Keyboard menu / V", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("textbox", { name: `Draft ${firstLabel?.replace("PS-", "")}`, exact: true }),
  ).toBeFocused();
});

test("search arrows skip inactive actions and leave text arrows in the input", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("/");
  const search = page.getByRole("textbox", { name: "Search keyboard choices" });
  await search.fill("Find");
  await page.keyboard.press("ArrowLeft");
  await expect(search).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Find available action", exact: true })).toBeFocused();
  await expect(page.getByRole("dialog").locator("kbd")).toHaveCount(0);
  await page.keyboard.press("Escape");
});
