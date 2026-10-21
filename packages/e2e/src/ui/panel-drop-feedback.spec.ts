import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(
    "pstdio-workbench-reference-core-api-panel-arrangement--closed-side",
    "pstdio-workbench",
  ));
});
test.afterAll(async () => stopStorybook(storybook));

for (const reversed of [false, true]) {
  test(`${reversed ? "left/top" : "right/bottom"}: nearby tab targets keep one stable outline through direct corner transitions`, async ({
    page,
  }) => {
    await page.goto(
      storyUrl(
        baseUrl,
        `pstdio-workbench-reference-core-api-panel-arrangement--closed-${reversed ? "reversed" : "side"}`,
      ),
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
    await expect.poll(() => main.boundingBox()).toEqual(before);
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2, { steps: 5 });
    await expect(closed).toHaveCount(0);
    await expect(outlines).toHaveCount(1);
    const edgeX = (inset: number) => before.x + (reversed ? inset : before.width - inset);
    const edgeY = (inset: number) => before.y + (reversed ? inset : before.height - inset);
    for (const [region, x, y] of [
      ["side", edgeX(12), before.y + before.height / 2],
      ["secondary", before.x + before.width / 2, edgeY(12)],
      ["side", edgeX(3), edgeY(8)],
      ["secondary", edgeX(8), edgeY(3)],
    ] as const) {
      await page.mouse.move(x, y, { steps: 6 });
      await expect(page.locator(`[data-workbench-edge-drop="${region}"]`)).toBeVisible();
      await expect(outlines).toHaveCount(1);
      await expect.poll(() => main.boundingBox()).toEqual(before);
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
