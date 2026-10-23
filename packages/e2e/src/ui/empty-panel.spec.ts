import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const prefix = "pstdio-workbench-reference-core-api-empty-panel--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}available-tabs`, "pstdio-workbench"));
});
test.afterAll(async () => stopStorybook(storybook));

test("empty panels offer the same permitted tabs as Add panel", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}available-tabs`));
  await waitForStoryPlayback(page);
  for (const region of ["main", "side", "secondary"]) {
    const panel = page.locator(`[data-workbench-panel="${region}"]`).filter({ visible: true });
    const cards = panel.getByRole("group", { name: "Available tabs" });
    const names = await cards.getByRole("button").allTextContents();
    expect(names).toEqual(region === "side" ? ["Inspector", "Session", "Terminal"] : ["Session", "Terminal"]);
    await panel.getByRole("button", { name: "Add panel", exact: true }).click();
    await expect(page.getByRole("menuitem")).toHaveText(names);
    await page.keyboard.press("Escape");
  }
});

for (const region of ["main", "side", "bottom"]) {
  test(`a card opens a tab in ${region}`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}open-in-${region}`));
    await waitForStoryPlayback(page);
    const panel = page
      .locator(`[data-workbench-panel="${region === "bottom" ? "secondary" : region}"]`)
      .filter({ visible: true });
    await expect(panel.getByRole("tab", { name: "Terminal", exact: true })).toBeVisible();
    await expect(panel.getByText("Terminal content", { exact: true })).toBeVisible();
  });
}

test("cards remain usable with a hidden header and in a narrow panel", async ({ page }) => {
  await page.setViewportSize({ width: 750, height: 650 });
  await page.goto(storyUrl(baseUrl, `${prefix}hidden-header`));
  await waitForStoryPlayback(page);
  const main = page.locator('[data-workbench-panel="main"]');
  await expect(main.getByRole("button", { name: "Terminal", exact: true })).toBeVisible();
  await expect(page.getByLabel("Main header edge", { exact: true })).toBeVisible();
  const card = main.getByRole("button", { name: "Terminal", exact: true });
  await card.focus();
  await card.press("Enter");
  await expect(main.getByText("Terminal content", { exact: true })).toBeVisible();
});

test("registered panel placeholders supply their own content", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}custom-placeholders`));
  await waitForStoryPlayback(page);
  for (const region of ["main", "side"]) {
    const panel = page.locator(`[data-workbench-panel="${region}"]`).filter({ visible: true });
    await expect(panel.getByText("Custom panel content", { exact: true })).toBeVisible();
  }
  await expect(
    page.locator('[data-workbench-panel="secondary"]').getByRole("group", { name: "Available tabs" }),
  ).toBeVisible();
});
