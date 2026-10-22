import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
const story = "pstdio-workbench-reference-core-api-panel-arrangement--closed-side";
test.beforeAll(async () => ({ baseUrl, storybook } = await startStorybook(story, "pstdio-workbench")));
test.afterAll(async () => stopStorybook(storybook));
const drag = async (page: Page, tab: Locator) => {
  await tab.hover();
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
  test(`closed ${region}: tab chooses ${position} and its last tab can move the panel to the opposite edge`, async ({
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
    const opposite = { left: "right", right: "left", top: "bottom", bottom: "top" }[position];
    const ownHit = page.locator(`[data-workbench-edge-hit="${region}"]`);
    await expect(ownHit).toHaveCount(1);
    await expect(ownHit).toHaveAttribute("data-workbench-edge-position", opposite);
    await ownHit.hover();
    await expect(target).toHaveAttribute("data-workbench-edge-position", opposite);
    await expect(page.locator("[data-workbench-edge-drop], [data-workbench-tab-drop][data-drop-active]")).toHaveCount(
      1,
    );
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect
      .poll(
        async () => sign * ((await destination.boundingBox())![initialAxis] - (await main.boundingBox())![initialAxis]),
      )
      .toBeGreaterThan(0);
    await drag(page, movedTab);
    await ownHit.hover();
    await page.mouse.up();
    await expect(destination.getByRole("tab")).toHaveCount(1);
    await expect(destination.locator(`[data-workbench-tab="${id}"]`)).toBeVisible();
    await expect(destination.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep this draft");
    await expect
      .poll(
        async () =>
          -sign * ((await destination.boundingBox())![initialAxis] - (await main.boundingBox())![initialAxis]),
      )
      .toBeGreaterThan(0);
    await destination.locator(`[data-workbench-tab="${id}"]`).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Unpin tab", exact: true })).toBeVisible();
  });
}

test("a floating Side's last tab docks its panel at the chosen edge", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-panel-arrangement--last-side-tab"));
  await waitForStoryPlayback(page);
  await page.getByRole("button", { name: "Float Side Panel", exact: true }).click();
  const panel = page.locator('[data-workbench-panel="side"]:visible');
  await expect(page.getByRole("button", { name: "Reattach Side Panel", exact: true })).toBeVisible();
  await panel.getByRole("textbox", { name: "Retained draft" }).fill("Keep my floating draft");
  const tab = panel.getByRole("tab", { selected: true });
  await drag(page, tab);
  await page.locator('[data-workbench-edge-hit="side"]').hover();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Reattach Side Panel", exact: true })).toBeVisible();
  await drag(page, tab);
  await page.locator('[data-workbench-edge-hit="side"]').hover();
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Float Side Panel", exact: true })).toBeVisible();
  await expect(panel.getByRole("tab")).toHaveCount(1);
  await expect(panel.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep my floating draft");
  const main = page.locator('[data-workbench-panel="main"]');
  const attached = page.getByTestId("workbench-side-panel-attached");
  await expect.poll(async () => (await attached.boundingBox())!.x < (await main.boundingBox())!.x).toBe(true);
});

test("a last Side tab can still drop onto a short Bottom tab near the opposite edge", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-panel-arrangement--short-destination-tab"));
  await waitForStoryPlayback(page);
  const side = page.locator('[data-workbench-panel="side"]:visible');
  const bottom = page.locator('[data-workbench-panel="secondary"]:visible');
  const source = side.getByRole("tab");
  const destination = bottom.getByRole("tab", { name: "T", exact: true });
  await expect(source).toHaveCount(1);
  await side.getByRole("textbox", { name: "Retained draft" }).fill("Move into the open tray");
  await destination.hover();
  await drag(page, source);
  const bounds = (await destination.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 8 });
  await expect(page.locator('[data-workbench-tab-drop="secondary"][data-drop-active]')).toBeVisible();
  await expect(page.locator('[data-workbench-edge-drop="side"]')).toHaveCount(0);
  await page.mouse.up();
  await expect(bottom.getByRole("tab")).toHaveCount(2);
  await expect(bottom.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Move into the open tray");
  await expect(side).toHaveCount(0);
});

test("a floating Side body keeps drop ownership over a covered Bottom tab", async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 720 });
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-panel-arrangement--secondary-session"));
  await waitForStoryPlayback(page);
  await page.getByRole("button", { name: "Float Side Panel", exact: true }).click();
  const floating = page.getByTestId("workbench-side-panel-floating");
  await expect(floating.getByRole("tab")).toBeVisible();
  const bottom = (await page.locator('[data-workbench-panel="secondary"]').getByRole("tab").boundingBox())!;
  const overlay = (await floating.boundingBox())!;
  const x = (Math.max(bottom.x, overlay.x) + Math.min(bottom.x + bottom.width, overlay.x + overlay.width)) / 2;
  const y = bottom.y + bottom.height / 2;
  expect(x).toBeGreaterThan(overlay.x);
  expect(x).toBeLessThan(bottom.x + bottom.width);
  expect(y).toBeGreaterThan(overlay.y);
  expect(y).toBeLessThan(overlay.y + overlay.height);
  await drag(page, floating.getByRole("tab"));
  await page.mouse.move(x, y, { steps: 8 });
  await expect(floating.locator('[data-workbench-tab-drop="side"][data-drop-active]')).toBeVisible();
  await expect(page.locator('[data-workbench-tab-drop="secondary"][data-drop-active]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
});

for (const position of ["left", "right"] as const) {
  test(`last-tab preview beside open ${position} Side keeps its Bottom corner reachable`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-panel-arrangement--last-side-tab"));
    await waitForStoryPlayback(page);
    if (position === "left") {
      const header = page.getByLabel("Side panel header", { exact: true });
      await header.focus();
      await header.press("Shift+F10");
      await page.getByRole("menuitem", { name: "Move panel to left", exact: true }).click();
    }
    const main = page.locator('[data-workbench-panel="main"]');
    const panel = page.locator('[data-workbench-panel="side"]:visible');
    await expect
      .poll(async () => (await panel.boundingBox())!.x < (await main.boundingBox())!.x === (position === "left"))
      .toBe(true);
    await main.hover();
    const bounds = (await main.boundingBox())!;
    const frame = (await page.locator('[data-workbench-panel-drop-frame="side"]').boundingBox())!;
    const x = position === "right" ? frame.x : frame.x + frame.width;
    const direction = position === "right" ? 1 : -1;
    await drag(page, panel.getByRole("tab", { selected: true }));
    const sideTarget = page.locator('[data-workbench-edge-drop="side"]');
    const bottomTarget = page.locator('[data-workbench-edge-drop="secondary"]');
    for (const _ of [0, 1]) {
      await page.mouse.move(x + direction * 3, bounds.y + bounds.height - 8, { steps: 6 });
      await expect(sideTarget).toBeVisible();
      await page.mouse.move(x + direction * 8, bounds.y + bounds.height - 3, { steps: 6 });
      await expect(bottomTarget).toBeVisible();
      await expect(page.locator("[data-workbench-edge-drop], [data-workbench-tab-drop][data-drop-active]")).toHaveCount(
        1,
      );
    }
    const side = (await panel.boundingBox())!;
    await page.mouse.move(side.x + side.width / 2, side.y + side.height - 3, { steps: 6 });
    await expect(bottomTarget).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(() => main.boundingBox()).toEqual(bounds);
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

for (const [region, singleStory, multipleStory, opposite] of [
  ["side", "last-side-tab", "headerless-main", "left"],
  ["secondary", "last-bottom-tab", "bottom-tabs", "top"],
] as const) {
  test(`last unpinned ${region} tab keeps its draft on cancellation and pins when moving its panel`, async ({
    page,
  }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-panel-arrangement--${singleStory}`));
    await waitForStoryPlayback(page);
    const panel = page.locator(`[data-workbench-panel="${region}"]:visible`);
    const tab = panel.getByRole("tab", { selected: true });
    const id = await tab.locator("..").getAttribute("data-workbench-tab");
    await panel.getByRole("textbox", { name: "Retained draft" }).fill("Keep my last tab");
    const before = (await panel.boundingBox())!;
    const hit = page.locator(`[data-workbench-edge-hit="${region}"]`);
    await drag(page, tab);
    await expect(hit).toHaveCount(1);
    await expect(hit).toHaveAttribute("data-workbench-edge-position", opposite);
    await hit.hover();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(() => panel.boundingBox()).toEqual(before);
    await tab.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Pin tab", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await drag(page, tab);
    await hit.hover();
    await page.mouse.up();
    await expect(panel.getByRole("tab")).toHaveCount(1);
    await expect(panel.locator(`[data-workbench-tab="${id}"]`)).toBeVisible();
    await expect(panel.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep my last tab");
    const main = page.locator('[data-workbench-panel="main"]');
    const axis = region === "side" ? "x" : "y";
    await expect.poll(async () => (await panel.boundingBox())![axis] < (await main.boundingBox())![axis]).toBe(true);
    await tab.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Unpin tab", exact: true })).toBeVisible();
  });

  test(`an open ${region} with multiple tabs offers no alternate edge`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-panel-arrangement--${multipleStory}`));
    await waitForStoryPlayback(page);
    const panel = page.locator(`[data-workbench-panel="${region}"]:visible`);
    await expect(panel.getByRole("tab")).toHaveCount(2);
    await drag(page, panel.getByRole("tab", { selected: true }));
    await expect(page.locator(`[data-workbench-edge-hit="${region}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test(`a fixed ${region} with one tab offers no alternate edge`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-panel-arrangement--fixed-${singleStory}`));
    await waitForStoryPlayback(page);
    const panel = page.locator(`[data-workbench-panel="${region}"]:visible`);
    await expect(panel.getByRole("tab")).toHaveCount(1);
    await drag(page, panel.getByRole("tab", { selected: true }));
    await expect(page.locator(`[data-workbench-edge-hit="${region}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
}
