import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startStorybook, stopStorybook, storyUrl, waitForStoryPlayback } from "./mermaid-renderer-storybook";

const prefix = "pstdio-workbench-reference-core-api-panel-arrangement--";
let baseUrl: string;
let storybook: ChildProcessWithoutNullStreams | undefined;
test.beforeAll(async () => {
  ({ baseUrl, storybook } = await startStorybook(`${prefix}closed-bottom`, "pstdio-workbench"));
});
test.afterAll(async () => {
  await stopStorybook(storybook);
});
const beginDrag = async (page: Page, source: Locator) => {
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2, { steps: 3 });
};

for (const [story, sourceRegion, targetRegion] of [
  ["closed-bottom", "side", "secondary"],
  ["closed-side", "main", "side"],
  ["closed-left-side", "main", "side"],
  ["closed-top-bottom", "side", "secondary"],
] as const) {
  test(`${story}: first drag opens ${targetRegion} only on a valid drop and preserves its live view`, async ({
    page,
  }) => {
    await page.goto(storyUrl(baseUrl, `${prefix}${story}`));
    await waitForStoryPlayback(page);
    const source = page.locator(`[data-workbench-panel="${sourceRegion}"]:visible`);
    const tab = source.getByRole("tab", { selected: true });
    const id = await tab.locator("..").getAttribute("data-workbench-tab");
    const draft = source.getByRole("textbox", { name: "Retained draft" });
    await draft.fill("Keep this draft");
    await beginDrag(page, tab);
    const target = page.locator(`[data-workbench-edge-drop="${targetRegion}"]`);
    await expect(target).toBeVisible();
    await target.hover();
    await expect(target).toHaveAttribute("data-drop-active", "true");
    await expect(target).toHaveText("");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(target).toHaveCount(0);
    await expect(source.locator(`[data-workbench-tab="${id}"]`)).toBeVisible();
    await beginDrag(page, tab);
    await target.hover();
    await page.mouse.up();
    const destination = page.locator(`[data-workbench-panel="${targetRegion}"]:visible`);
    await expect(destination.locator(`[data-workbench-tab="${id}"]`)).toBeVisible();
    await expect(destination.getByRole("textbox", { name: "Retained draft" })).toHaveValue("Keep this draft");
    await destination.locator(`[data-workbench-tab="${id}"]`).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Unpin tab", exact: true })).toBeVisible();
  });
}

test("whole Side panel drag and keyboard placement preserve its tabs", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}headerless-main`));
  await waitForStoryPlayback(page);
  const header = page.getByLabel("Side panel header", { exact: true });
  const main = page.locator('[data-workbench-panel="main"]');
  const side = page.locator('[data-workbench-panel="side"]:visible');
  const box = (await header.boundingBox())!;
  // Header padding is deliberately separate from the tab and control gestures.
  await page.mouse.move(box.x + 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 15, box.y + box.height / 2, { steps: 3 });
  const target = page.locator('[data-workbench-edge-drop="panel-left"]');
  await expect(target).toBeVisible();
  const insertion = (await target.boundingBox())!;
  await page.mouse.move(insertion.x + insertion.width / 2, insertion.y + insertion.height / 2);
  await page.mouse.up();
  await expect.poll(async () => (await side.boundingBox())!.x - (await main.boundingBox())!.x).toBeLessThan(0);
  await expect(side.getByRole("tab")).toHaveCount(2);
  await header.focus();
  await header.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move panel to right", exact: true }).click();
  await expect.poll(async () => (await side.boundingBox())!.x - (await main.boundingBox())!.x).toBeGreaterThan(0);
});

for (const [region, story, edge] of [
  ["side", "interactive", "left"],
  ["secondary", "interactive", "top"],
  ["side", "reversed", "right"],
  ["secondary", "reversed", "bottom"],
  ["side", "dark", "left"],
  ["secondary", "dark", "top"],
] as const) {
  test(`${region} ${story} insertion takes space and accepts the nearest drop`, async ({ page }) => {
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-whole-panel-placement--${story}`));
    await waitForStoryPlayback(page);
    const header = page.getByLabel(region === "side" ? "Side panel header" : "Bottom panel header", { exact: true });
    const main = page.locator('[data-workbench-panel="main"]');
    const before = (await main.boundingBox())!;
    const source = (await header.boundingBox())!;
    await page.mouse.move(source.x + 3, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + 15, source.y + source.height / 2, { steps: 3 });
    const target = page.locator(`[data-workbench-edge-drop="panel-${edge}"]`);
    await expect(target).toBeVisible();
    const slot = (await target.boundingBox())!;
    const during = (await main.boundingBox())!;
    if (region === "side") {
      const nav = (await page.locator('[data-workbench-region="sidenav"]').boundingBox())!;
      if (edge === "left") {
        expect(slot.x).toBeGreaterThanOrEqual(nav.x + nav.width);
        expect(slot.x + slot.width).toBeLessThanOrEqual(during.x);
      } else {
        expect(slot.x).toBeGreaterThanOrEqual(during.x + during.width);
        expect(slot.x + slot.width).toBeLessThanOrEqual(nav.x);
      }
      expect(during.width).toBeLessThan(before.width);
    } else {
      if (edge === "top") expect(slot.y + slot.height).toBeLessThanOrEqual(during.y);
      else expect(slot.y).toBeGreaterThanOrEqual(during.y + during.height);
      expect(during.height).toBeLessThan(before.height);
    }
    expect(await page.locator('[data-workbench-edge-drop^="panel-"]').count()).toBe(1);
    // Release in the content near the insertion, without having to reach the narrow target.
    await page.mouse.move(during.x + during.width / 3, during.y + during.height / 3, { steps: 6 });
    await expect(target).toHaveAttribute("data-drop-active", "true");
    const fill = await target.evaluate((element) => getComputedStyle(element, "::after").backgroundColor);
    expect(fill).not.toBe("rgba(0, 0, 0, 0)");
    const line = target.locator("[data-workbench-insertion-line]");
    await expect(line).toBeVisible();
    const marker = (await line.boundingBox())!;
    expect(region === "side" ? marker.height > marker.width : marker.width > marker.height).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${region}-${story}-insertion.png`) });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect.poll(async () => (await main.boundingBox())!.width).toBe(before.width);
    await expect.poll(async () => (await main.boundingBox())!.height).toBe(before.height);
    const restored = (await header.boundingBox())!;
    await page.mouse.move(restored.x + 3, restored.y + restored.height / 2);
    await page.mouse.down();
    await page.mouse.move(restored.x + 15, restored.y + restored.height / 2, { steps: 3 });
    await page.mouse.move(during.x + during.width / 3, during.y + during.height / 3, { steps: 6 });
    await expect(target).toHaveAttribute("data-drop-active", "true");
    await page.mouse.up();
    const moved = (await page.locator(`[data-workbench-panel="${region}"]:visible`).boundingBox())!;
    const placedMain = (await main.boundingBox())!;
    const delta = region === "side" ? moved.x - placedMain.x : moved.y - placedMain.y;
    expect(edge === "left" || edge === "top" ? delta < 0 : delta > 0).toBe(true);
  });
}

test("the action bar selects the nearest insertion without overlapping targets", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-whole-panel-placement--interactive"));
  await waitForStoryPlayback(page);
  await beginDrag(page, page.locator('[data-workbench-panel-drag="activity"]'));
  const top = page.locator('[data-workbench-edge-drop="panel-top"]');
  const right = page.locator('[data-workbench-edge-drop="panel-right"]');
  const bottom = page.locator('[data-workbench-edge-drop="panel-bottom"]');
  const t = (await top.boundingBox())!;
  const r = (await right.boundingBox())!;
  const b = (await bottom.boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(r.y);
  expect(r.y + r.height).toBeLessThanOrEqual(b.y);
  await page.mouse.move(r.x - 80, r.y + r.height / 2, { steps: 6 });
  await expect(right).toHaveAttribute("data-drop-active", "true");
  await page.mouse.move(t.x + t.width / 2, t.y + t.height + 80, { steps: 6 });
  await expect(top).toHaveAttribute("data-drop-active", "true");
  await expect(right).not.toHaveAttribute("data-drop-active");
  await page.mouse.move(b.x + b.width / 2, b.y - 80, { steps: 6 });
  await expect(bottom).toHaveAttribute("data-drop-active", "true");
  await expect(page.locator('[data-workbench-edge-drop^="panel-"]')).toHaveCount(3);
  await page.mouse.move(0, 0, { steps: 6 });
  await expect(page.locator("[data-workbench-edge-drop][data-drop-active]")).toHaveCount(0);
  await page.mouse.up();
  await expect
    .poll(async () => (await page.locator('[data-workbench-panel-drag="activity"]').boundingBox())!.x)
    .toBe(0);
});

test("whole-panel drags finish over embedded Navigation content", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-whole-panel-placement--embedded-navigation"));
  await waitForStoryPlayback(page);
  const header = (await page.getByLabel("Side panel header", { exact: true }).boundingBox())!;
  await page.mouse.move(header.x + 3, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x + 15, header.y + header.height / 2, { steps: 3 });
  const view = (await page.getByTitle("Navigation view").boundingBox())!;
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2, { steps: 6 });
  await expect(page.locator('[data-workbench-edge-drop="panel-left"]')).toHaveAttribute("data-drop-active", "true");
  await page.mouse.up();
  await expect(page.locator("[data-workbench-panel-drag-shield]")).toHaveCount(0);
  const side = (await page.locator('[data-workbench-panel="side"]:visible').boundingBox())!;
  const main = (await page.locator('[data-workbench-panel="main"]').boundingBox())!;
  expect(side.x).toBeLessThan(main.x);
});

for (const [region, edge] of [
  ["main", "bottom"],
  ["secondary", "top"],
  ["sidenav", "right"],
  ["activity", "bottom"],
  ["activity", "top"],
  ["activity", "left"],
  ["activity", "right"],
] as const) {
  test(`move whole ${region} by pointer to ${edge}`, async ({ page }) => {
    const story = region === "activity" && edge === "left" ? "reversed" : "interactive";
    await page.goto(storyUrl(baseUrl, `pstdio-workbench-reference-core-api-whole-panel-placement--${story}`));
    await waitForStoryPlayback(page);
    const surface = page.locator(`[data-workbench-panel-drag="${region}"]:visible`);
    const source = region === "main" ? surface.locator("[data-workbench-breadcrumb-action-slot] + div") : surface;
    const box = (await source.boundingBox())!;
    let startX = box.x + 3;
    if (region === "main" || (region === "activity" && box.width > box.height)) startX = box.x + box.width / 2;
    await page.mouse.move(startX, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(startX + 12, box.y + box.height / 2, { steps: 3 });
    const target = page.locator(`[data-workbench-edge-drop="panel-${edge}"]`);
    await expect(target).toBeVisible();
    const insertion = (await target.boundingBox())!;
    await page.mouse.move(insertion.x + insertion.width / 2, insertion.y + insertion.height / 2);
    await page.mouse.up();
    const main = page.locator('[data-workbench-panel="main"]');
    const secondary = page.locator('[data-workbench-panel="secondary"]');
    if (region === "main" || region === "secondary")
      await expect.poll(async () => (await secondary.boundingBox())!.y - (await main.boundingBox())!.y).toBeLessThan(0);
    if (region === "sidenav")
      await expect
        .poll(async () => (await surface.boundingBox())!.x - (await main.boundingBox())!.x)
        .toBeGreaterThan(0);
    if (region === "activity") {
      const coordinate = edge === "left" || edge === "right" ? "x" : "y";
      const sign = edge === "left" || edge === "top" ? -1 : 1;
      await expect
        .poll(async () => sign * ((await surface.boundingBox())![coordinate] - (await main.boundingBox())![coordinate]))
        .toBeGreaterThan(0);
    }
  });
}

test("an invalid drop leaves its preview unpinned in the source", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, `${prefix}disallowed-webview-destination`));
  await waitForStoryPlayback(page);
  const side = page.locator('[data-workbench-panel="side"]:visible');
  const tab = side.getByRole("tab", { selected: true });
  const id = await tab.locator("..").getAttribute("data-workbench-tab");
  await beginDrag(page, tab);
  const main = (await page.locator('[data-workbench-panel="main"]').boundingBox())!;
  await page.mouse.move(main.x + main.width / 2, main.y + main.height / 2, { steps: 8 });
  await page.mouse.up();
  const retained = side.locator(`[data-workbench-tab="${id}"]`);
  await expect(retained).toBeVisible();
  await retained.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Pin tab", exact: true })).toBeVisible();
});

test("restricted modes omit whole-panel move controls and targets", async ({ page }) => {
  await page.goto(storyUrl(baseUrl, "pstdio-workbench-reference-core-api-whole-panel-placement--restricted"));
  await waitForStoryPlayback(page);
  const header = page.getByLabel("Side panel header", { exact: true });
  await header.focus();
  await header.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: /^Move panel/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  const box = (await header.boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 15, box.y + box.height / 2, { steps: 3 });
  await expect(page.locator('[data-workbench-edge-drop^="panel-"]')).toHaveCount(0);
  await page.mouse.up();
});
