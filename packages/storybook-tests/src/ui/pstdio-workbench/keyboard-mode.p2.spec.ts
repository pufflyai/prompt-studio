import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "../storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
const prefix = "pstdio-workbench-reference-keyboard--";
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}visible-panels`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});

test("a numbered chord selects a tab without entering shortcut mode", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  await page.getByRole("textbox", { name: "Draft 4", exact: true }).fill("Keep Secondary draft");
  await page.keyboard.down("Alt");
  const firstLabelId = await page
    .locator("[data-keyboard-tab-shortcut]")
    .filter({ hasText: /1$/ })
    .locator('xpath=ancestor::*[@role="tab"]')
    .getAttribute("aria-labelledby");
  const firstLabel = await page.locator(`[id="${firstLabelId}"]`).textContent();
  await page.keyboard.up("Alt");
  await page.keyboard.press("Alt+Shift+1");
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeHidden();
  await expect(
    page.getByRole("textbox", { name: `Draft ${firstLabel?.replace("PS-", "")}`, exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Draft 4", exact: true })).toHaveValue("Keep Secondary draft");
});

test("holding Alt previews tab chords and shortcut mode selects by plain number", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  const shortcuts = page.locator("[data-keyboard-tab-shortcut]");
  await expect(shortcuts).toHaveCount(0);
  const chord = page.getByRole("status", { name: "Shortcut mode chord", exact: true });
  await page.keyboard.down("Alt");
  await expect(shortcuts).toHaveCount(4);
  await expect(chord).toBeVisible();
  await expect(chord).toContainText("Space");
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeHidden();
  await page.keyboard.up("Alt");
  await expect(shortcuts).toHaveCount(0);
  await expect(chord).toBeHidden();
  await page.keyboard.press("Alt+Shift+Space");
  const mode = page.getByRole("region", { name: "Keyboard shortcut mode", exact: true });
  await expect(mode).toBeVisible();
  const numberedTab = (number: number) =>
    shortcuts.filter({ hasText: new RegExp(`^${number}$`) }).locator('xpath=ancestor::*[@role="tab"]');
  const secondLabelId = await numberedTab(2).getAttribute("aria-labelledby");
  const secondLabel = await page.locator(`[id="${secondLabelId}"]`).textContent();
  await page.keyboard.press("2");
  await expect(numberedTab(2)).toHaveAttribute("data-keyboard-selected", "");
  await expect(mode).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(mode).toBeHidden();
  await expect(
    page.getByRole("textbox", { name: `Draft ${secondLabel?.replace("PS-", "")}`, exact: true }),
  ).toBeFocused();
});

test("Ctrl Tab cycles tabs and Ctrl Shift Tab goes back without entering shortcut mode", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  await page.getByRole("tab", { name: "PS-1", exact: true }).click();
  await page.getByRole("textbox", { name: "Draft 1", exact: true }).fill("Keep Main draft");
  await page.keyboard.press("Control+Tab");
  await page.keyboard.type(" next tab");
  await expect(page.getByRole("textbox", { name: "Draft 2", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Draft 2", exact: true })).toHaveValue(/ next tab/);
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeHidden();
  await page.keyboard.press("Control+Shift+Tab");
  await expect(page.getByRole("textbox", { name: "Draft 1", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Draft 1", exact: true })).toHaveValue("Keep Main draft");
});

test("fast entry owns keys, tab navigation stays active and exits into Secondary", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}visible-panels`));
  await waitForStoryPlayback(page);
  const draft = page.getByRole("textbox", { name: "Draft 4", exact: true });
  await draft.fill("Unsaved Secondary");
  await draft.dispatchEvent("keydown", {
    key: "\u00a0",
    code: "Space",
    altKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  await page.keyboard.press("g");
  await page.keyboard.press("Control+Shift+Tab");
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeVisible();
  await expect(draft).toHaveValue("Unsaved Secondary");
  await page.keyboard.press("Alt+Shift+4");
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "PS-4", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(draft).toBeFocused();
  await expect(page.locator("[data-keyboard-tab-shortcut]")).toHaveCount(0);
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
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeHidden();
});

test("tabs beyond nine use the direct picker and tab navigation wraps", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}crowded-tabs`));
  await waitForStoryPlayback(page);
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("g");
  await expect
    .poll(() =>
      page.locator('[role="tablist"]').evaluateAll((strips) => {
        const first = [...strips].sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top ||
            a.getBoundingClientRect().left - b.getBoundingClientRect().left,
        )[0];
        return first?.querySelector("[data-keyboard-tab-shortcut]")?.textContent;
      }),
    )
    .toBe("1");
  const firstLabelId = await page
    .locator("[data-keyboard-tab-shortcut]")
    .filter({ hasText: /^1$/ })
    .locator('xpath=ancestor::*[@role="tab"]')
    .getAttribute("aria-labelledby");
  const firstLabel = await page.locator(`[id="${firstLabelId}"]`).textContent();
  await page.keyboard.press("Alt+Shift+0");
  const picker = page.getByRole("dialog", { name: "Select tab", exact: true });
  await expect(picker).toBeVisible();
  await expect(picker.getByText(/^10 ·/)).toBeVisible();
  await page.keyboard.press("1");
  await expect(picker).toBeHidden();
  await page.keyboard.press("Control+Tab");
  await page.keyboard.press("Control+Tab");
  await page.keyboard.press("Control+Tab");
  await expect(page.getByRole("region", { name: "Keyboard shortcut mode", exact: true })).toBeVisible();
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
  await expect(page.locator("[data-keyboard-choice] kbd")).toHaveCount(0);
  await page.keyboard.press("Escape");
});
