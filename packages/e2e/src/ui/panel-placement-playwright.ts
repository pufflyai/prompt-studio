import { expect, type Locator, type Page } from "@playwright/test";
import { movePanelTab } from "../helpers/move-panel-tab";

const startTabDrag = async (page: Page, tab: Locator) => {
  const source = (await tab.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, { steps: 3 });
};
const hoverTarget = async (page: Page, target: Locator) => {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await expect(target).toHaveAttribute("data-drop-active", "true");
};
export const exerciseClosedEdges = async (page: Page) => {
  const main = page.locator('[data-workbench-panel-header="main"]');
  const files = main.getByRole("tab", { name: /^Files/ });
  const draft = page.getByRole("textbox", { name: "Files draft" });
  await draft.fill("Retain this draft through edge drops");
  const mount = await page.getByLabel("Files mount").filter({ visible: true }).textContent();
  const instance = await files.locator("..").getAttribute("data-workbench-tab");
  for (const region of ["aside", "side", "secondary", "bottom"]) {
    const destination =
      region === "side"
        ? page.getByTestId("workbench-side-panel-attached")
        : page.locator(`[data-workbench-panel="${region}"]`);
    await startTabDrag(page, files);
    const target = page.locator(`[data-workbench-edge-target="${region}"]`);
    await expect(target).toBeVisible();
    await hoverTarget(page, target);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(destination).not.toBeVisible();
    await expect(files).toBeVisible();
    await startTabDrag(page, files);
    await hoverTarget(page, target);
    await testScreenshot(page, `Closed ${region} preview`);
    await page.mouse.up();
    const moved = destination.locator(`[data-workbench-tab="${instance}"]`).getByRole("tab");
    await expect(moved).toBeVisible();
    await expect(draft).toHaveValue("Retain this draft through edge drops");
    await expect(page.getByLabel("Files mount").filter({ visible: true })).toHaveText(mount!);
    await movePanelTab(page, moved, page.locator('[data-workbench-region="main"]'));
    await expect(files).toBeVisible();
  }
};
const testScreenshot = async (page: Page, name: string) => {
  const { test } = await import("@playwright/test");
  await test.info().attach(name, { body: await page.screenshot(), contentType: "image/png" });
};
export const exercisePanelPointer = async (page: Page) => {
  const header = page.locator('[data-workbench-panel-drag="side"]');
  const source = (await header.boundingBox())!;
  const side = page.getByTestId("workbench-side-panel-attached");
  const original = (await side.boundingBox())!;
  // The empty header area follows the tab/Add controls and precedes its options.
  const x = source.x + source.width * 0.65;
  const y = source.y + source.height / 2;
  for (const cancel of [true, false]) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 8, y, { steps: 3 });
    const target = page.locator('[data-workbench-edge-target="side"][data-edge="right"]');
    await expect(target).toBeVisible();
    await expect(page.locator('[data-workbench-edge-target="side"][data-edge="top"]')).toHaveCount(0);
    await hoverTarget(page, target);
    if (cancel) {
      await page.keyboard.press("Escape");
      await page.mouse.up();
      expect((await side.boundingBox())!.x).toBe(original.x);
    } else {
      await page.mouse.up();
      await expect.poll(async () => (await side.boundingBox())!.x).toBeGreaterThan(original.x);
    }
  }
  const breadcrumb = (await page
    .locator('[data-workbench-panel-drag="main"][data-workbench-region="nav"]')
    .boundingBox())!;
  await page.mouse.move(breadcrumb.x + breadcrumb.width * 0.65, breadcrumb.y + breadcrumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(breadcrumb.x + breadcrumb.width * 0.65 + 8, breadcrumb.y + breadcrumb.height / 2, { steps: 3 });
  const flip = page.locator('[data-workbench-edge-target="main"][data-edge="top"]');
  await expect(flip).toBeVisible();
  await hoverTarget(page, flip);
  await page.mouse.up();
  const main = page.locator('[data-workbench-panel="main"]');
  const secondary = page.locator('[data-workbench-panel="secondary"]');
  await expect
    .poll(async () => {
      const a = (await main.boundingBox())!;
      const b = (await secondary.boundingBox())!;
      return a.y + a.height < b.y;
    })
    .toBe(true);
};
export const exerciseTabInsertion = async (page: Page) => {
  const header = page.locator('[data-workbench-panel-header="main"]');
  const tabs = header.getByRole("tab");
  const files = tabs.filter({ hasText: "Files" });
  const changes = tabs.filter({ hasText: "Changes" });
  await startTabDrag(page, changes);
  const target = (await files.boundingBox())!;
  await page.mouse.move(target.x + 4, target.y + target.height / 2, { steps: 12 });
  await expect(header.locator("[data-tab-drop-indicator]")).toBeVisible();
  await page.mouse.up();
  await expect(tabs.first()).toHaveText(/Changes/);
};
