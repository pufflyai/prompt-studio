import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
const story = "pstdio-workbench-reference-core-api-panel-arrangement--closed-side";
test.beforeAll(async () => ({ baseUrl, storybook } = await startStorybook(story, "pstdio-workbench")));
test.afterAll(async () => stopStorybook(storybook));
const drag = async (page: Page, tab: Locator) => {
  const bounds = (await tab.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 12, bounds.y + bounds.height / 2, { steps: 3 });
};

test("Main exposes vertical movement only while Bottom is open", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, story));
  await waitForStoryPlayback(page);
  const header = page.getByLabel("Main panel header", { exact: true });
  await expect(header).not.toHaveAttribute("data-panel-draggable");
  await header.focus();
  await header.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: /^Move panel to / })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const bounds = (await header.boundingBox())!;
  await page.mouse.move(bounds.x + 3, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 23, bounds.y + bounds.height / 2, { steps: 4 });
  await expect(page.locator('[data-workbench-edge-drop^="panel-"]')).toHaveCount(0);
  await page.mouse.up();
  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  await expect(header).toHaveAttribute("data-panel-draggable", "true");
  await header.focus();
  await header.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Move panel to bottom", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await expect(header).not.toHaveAttribute("data-panel-draggable");
});

for (const [region, position] of [
  ["side", "left"],
  ["side", "right"],
  ["secondary", "top"],
  ["secondary", "bottom"],
] as const) {
  test(`closed ${region}: tab drop chooses ${position}, cancellation keeps the saved edge, and open panels have no alternate edge`, async ({
    page,
  }) => {
    await page.goto(storyUrl(baseUrl, story));
    await waitForStoryPlayback(page);
    const main = page.locator('[data-workbench-panel="main"]');
    const tab = main.getByRole("tab", { selected: true });
    const id = await tab.locator("..").getAttribute("data-workbench-tab");
    await main.getByRole("textbox", { name: "Retained draft" }).fill("Keep this draft");
    const hit = page.locator(`[data-workbench-edge-hit="${region}"][data-workbench-edge-position="${position}"]`);
    await drag(page, tab);
    await hit.hover();
    const target = page.locator(`[data-workbench-edge-drop="${region}"]`);
    await expect(target).toHaveCount(1);
    await expect(target).toHaveAttribute("data-workbench-edge-position", position);
    await expect(page.locator("[data-workbench-edge-drop], [data-workbench-tab-drop][data-drop-active]")).toHaveCount(
      1,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(`[data-workbench-panel="${region}"]:visible`)).toHaveCount(0);
    const center = (await main.boundingBox())!;
    await page.mouse.move(center.x + center.width / 2, center.y + center.height / 2, { steps: 6 });
    // Opening after cancellation must retain the old placement.
    await page
      .getByRole("button", { name: region === "side" ? "Show Side Panel" : "Show Bottom Panel", exact: true })
      .click();
    const destination = page.locator(`[data-workbench-panel="${region}"]:visible`);
    await expect(destination).toBeVisible();
    const initialAxis = region === "side" ? "x" : "y";
    await expect
      .poll(async () => (await destination.boundingBox())![initialAxis] - (await main.boundingBox())![initialAxis])
      .toBeGreaterThan(0);
    await page
      .getByRole("button", { name: region === "side" ? "Hide Side Panel" : "Hide Bottom Panel", exact: true })
      .click();
    await expect(destination).toHaveCount(0);
    await drag(page, tab);
    await hit.hover();
    await page.mouse.up();
    await expect(destination.locator(`[data-workbench-tab="${id}"]`)).toBeVisible();
    await expect(destination.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep this draft");
    const sign = position === "left" || position === "top" ? -1 : 1;
    await expect
      .poll(
        async () => sign * ((await destination.boundingBox())![initialAxis] - (await main.boundingBox())![initialAxis]),
      )
      .toBeGreaterThan(0);
    const movedTab = destination.getByRole("tab", { selected: true });
    await drag(page, movedTab);
    await expect(page.locator(`[data-workbench-edge-hit="${region}"]`)).toHaveCount(0);
    const reference = (await main.boundingBox())!;
    const oppositeX = position === "right" ? reference.x + 3 : reference.x + reference.width - 3;
    const oppositeY = position === "bottom" ? reference.y + 3 : reference.y + reference.height - 3;
    await page.mouse.move(
      region === "side" ? oppositeX : reference.x + reference.width / 2,
      region === "secondary" ? oppositeY : reference.y + reference.height / 2,
      { steps: 6 },
    );
    await expect(page.locator(`[data-workbench-edge-drop="${region}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await destination.locator(`[data-workbench-tab="${id}"]`).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Unpin tab", exact: true })).toBeVisible();
  });
}

test("closed fixed panels keep their permitted edge when accepting tabs", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-whole-panel-placement--restricted"));
  await waitForStoryPlayback(page);
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await expect(page.locator('[data-workbench-panel="side"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  const main = page.locator('[data-workbench-panel="main"]');
  const tab = main.getByRole("tab", { selected: true });
  const id = await tab.locator("..").getAttribute("data-workbench-tab");
  await drag(page, tab);
  for (const [region, position] of [
    ["side", "right"],
    ["secondary", "bottom"],
  ]) {
    const hit = page.locator(`[data-workbench-edge-hit="${region}"]`);
    await expect(hit).toHaveCount(1);
    await expect(hit).toHaveAttribute("data-workbench-edge-position", position);
  }
  const bounds = (await main.boundingBox())!;
  await page.mouse.move(bounds.x + 3, bounds.y + bounds.height / 2, { steps: 6 });
  await expect(page.locator('[data-workbench-edge-drop="side"]')).toHaveCount(0);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 3, { steps: 6 });
  await expect(page.locator('[data-workbench-edge-drop="secondary"]')).toHaveCount(0);
  await page.locator('[data-workbench-edge-hit="side"]').hover();
  await page.mouse.up();
  await expect(page.locator(`[data-workbench-panel="side"]:visible [data-workbench-tab="${id}"]`)).toBeVisible();
});
