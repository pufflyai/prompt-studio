import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(
    "pstdio-workbench-reference-core-api-panel-arrangement--closed-side",
    "pstdio-workbench",
  ));
});
test.afterAll(async () => stopStorybook(storybook));

for (const [left, top] of [
  [false, false],
  [true, true],
  [false, true],
  [true, false],
] as const) {
  test(`${left ? "left" : "right"}/${top ? "top" : "bottom"}: nearby tab targets reserve space with one stable outline through corner transitions`, async ({
    page,
  }) => {
    await page.goto(
      storyUrl(baseUrl, `pstdio-workbench-reference-core-api-panel-arrangement--closed-${left ? "reversed" : "side"}`),
    );
    await waitForStoryPlayback(page);
    const main = page.locator('[data-workbench-panel="main"]');
    const before = (await main.boundingBox())!;
    const tab = main.getByRole("tab", { selected: true });
    const start = (await tab.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 3 });
    const closed = page.locator("[data-workbench-edge-drop]");
    const outlines = page.locator("[data-workbench-edge-drop], [data-workbench-tab-drop][data-drop-active]");
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2, { steps: 5 });
    await expect(closed).toHaveCount(0);
    await expect.poll(() => main.boundingBox()).toEqual(before);
    await expect(outlines).toHaveCount(1);
    const edgeX = (inset: number) => before.x + (left ? inset : before.width - inset);
    const edgeY = (inset: number) => before.y + (top ? inset : before.height - inset);
    for (const [region, x, y] of [
      ["side", edgeX(12), before.y + before.height / 2],
      ["secondary", before.x + before.width / 2, edgeY(12)],
      ["side", edgeX(3), edgeY(8)],
      ["secondary", edgeX(8), edgeY(3)],
    ] as const) {
      await page.mouse.move(x, y, { steps: 6 });
      const target = page.locator(`[data-workbench-edge-drop="${region}"]`);
      await expect(target).toBeVisible();
      await expect(outlines).toHaveCount(1);
      const slot = (await target.boundingBox())!;
      const horizontal = region === "side";
      await expect
        .poll(() => main.boundingBox())
        .toEqual({
          x: before.x + (horizontal && left ? slot.width : 0),
          y: before.y + (!horizontal && top ? slot.height : 0),
          width: before.width - (horizontal ? slot.width : 0),
          height: before.height - (horizontal ? 0 : slot.height),
        });
    }
    await page.mouse.move(edgeX(3), edgeY(8), { steps: 3 });
    await expect(page.locator('[data-workbench-edge-drop="side"]')).toBeVisible();
    // Keep the pointer still across more than one rendering frame: the outline must not shift its own hit area.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('[data-workbench-edge-drop="side"]')).toBeVisible();
    await expect(outlines).toHaveCount(1);
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2, { steps: 6 });
    await expect(closed).toHaveCount(0);
    await expect.poll(() => main.boundingBox()).toEqual(before);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(outlines).toHaveCount(0);
  });
}

for (const story of ["interactive", "reversed"]) {
  test(`${story}: Navigation icon mirrors on the right, including while Navigation is closed`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-whole-panel-placement--${story}`));
    await waitForStoryPlayback(page);
    const toggle = page.getByRole("button", { name: /^(Show|Hide) Sidenav$/ });
    const icon = toggle.locator(".chakra-icon");
    for (const position of story === "reversed" ? ["right", "left"] : ["left", "right"]) {
      await expect(icon).toHaveCSS("transform", position === "right" ? "matrix(-1, 0, 0, 1, 0, 0)" : "none");
      await toggle.click();
      await expect(toggle).toHaveAccessibleName("Show Sidenav");
      await expect(icon).toHaveCSS("transform", position === "right" ? "matrix(-1, 0, 0, 1, 0, 0)" : "none");
      await toggle.click();
      const nav = page.locator('[data-workbench-panel-drag="sidenav"]');
      await nav.focus();
      await nav.press("Shift+F10");
      await page
        .getByRole("menuitem", { name: `Move panel to ${position === "left" ? "right" : "left"}`, exact: true })
        .click();
    }
  });
}

for (const story of ["headerless-main", "detached-side"]) {
  test(`${story}: only the displayed Side presentation paints a tab target`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-panel-arrangement--${story}`));
    await waitForStoryPlayback(page);
    const side = page.locator('[data-workbench-panel="side"]:visible');
    const tab = side.getByRole("tab", { selected: true });
    const start = (await tab.boundingBox())!;
    const bounds = (await side.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 3 });
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 6 });
    await expect(page.locator("[data-workbench-tab-drop][data-drop-active]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
}

test("Bottom tab insertion takes space only in Main's column beside an open Side", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-panel-arrangement--headerless-main"));
  await waitForStoryPlayback(page);
  await page.getByRole("button", { name: "Hide Bottom Panel", exact: true }).click();
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  const side = page.locator('[data-workbench-panel="side"]:visible');
  const main = page.locator('[data-workbench-panel="main"]');
  const before = (await main.boundingBox())!;
  const sideBounds = (await side.boundingBox())!;
  const start = (await side.getByRole("tab", { selected: true }).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 3 });
  await page.mouse.move(sideBounds.x + sideBounds.width / 2, sideBounds.y + sideBounds.height - 3, { steps: 6 });
  const target = page.locator('[data-workbench-edge-drop="secondary"]');
  await expect(target).toHaveCount(0);
  await expect(page.locator('[data-workbench-tab-drop="side"][data-drop-active]')).toHaveCount(1);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height - 3, { steps: 6 });
  await expect(target).toBeVisible();
  const slot = (await target.boundingBox())!;
  expect(slot.x + slot.width).toBeLessThanOrEqual(sideBounds.x);
  await expect.poll(() => main.boundingBox()).toEqual({ ...before, height: before.height - slot.height });
  await expect.poll(() => side.boundingBox()).toEqual(sideBounds);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => main.boundingBox()).toEqual(before);
});
