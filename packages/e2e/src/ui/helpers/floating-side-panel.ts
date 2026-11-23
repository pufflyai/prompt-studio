import type { Page, TestInfo } from "@playwright/test";
import { expect } from "../../scripts/session-test";

// Critical risk: moving and resizing a live Side iframe must keep its draft and controls reachable.
export const verifyFreeFloatingSidePanel = async (page: Page, info: TestInfo) => {
  const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
  await bubble.click();
  const panel = page.getByTestId("workbench-side-panel-floating");
  const header = panel.locator('[data-workbench-panel-header="side"]');
  const draft = panel.getByTestId("content-editable").filter({ visible: true });
  await draft.fill("Keep this draft through free movement and resizing");
  const initial = (await panel.boundingBox())!;
  const topLeft = (await panel
    .getByRole("button", { name: "Resize Side Panel from top left", exact: true })
    .boundingBox())!;
  await page.mouse.move(topLeft.x + topLeft.width / 2, topLeft.y + topLeft.height / 2);
  await page.mouse.down();
  await page.mouse.move(topLeft.x + topLeft.width / 2 + 96, topLeft.y + topLeft.height / 2 + 160, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(initial.width - 96, 0);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeCloseTo(initial.height - 160, 0);
  await header.click({ button: "right", position: { x: 24, y: 12 } });
  await page.getByRole("menuitem", { name: "Move freely", exact: true }).click();
  const beforeMove = (await panel.boundingBox())!;
  const grip = (await header.boundingBox())!;
  await page.mouse.move(grip.x + 24, grip.y + 12);
  await page.mouse.down();
  await page.mouse.move(grip.x + 24 - 180, grip.y + 12 - 96, { steps: 8 });
  await expect(page.locator("[data-side-panel-drop-slot]")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.x).toBeCloseTo(beforeMove.x - 180, 0);
  await expect.poll(async () => (await panel.boundingBox())!.y).toBeCloseTo(beforeMove.y - 96, 0);
  const beforeResize = (await panel.boundingBox())!;
  const bottomRight = panel.getByRole("button", { name: "Resize Side Panel from bottom right", exact: true });
  const handle = (await bottomRight.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 64, handle.y + handle.height / 2 + 48, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(beforeResize.width + 64, 0);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeCloseTo(beforeResize.height + 48, 0);
  const beforeKey = (await panel.boundingBox())!;
  await bottomRight.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(beforeKey.width);
  await expect(draft).toContainText("Keep this draft through free movement and resizing");
  await page.screenshot({ path: info.outputPath("free-floating-panel.png") });
  const saved = (await panel.boundingBox())!;
  await panel.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await bubble.click();
  await expect.poll(() => panel.boundingBox()).toEqual(saved);
  await panel.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await page.reload();
  await expect(bubble).toBeVisible();
  await bubble.click();
  await expect.poll(() => panel.boundingBox()).toEqual(saved);
  await panel.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByRole("option", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: "Move freely", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Snap to alignment", exact: true }).click();
  await page.keyboard.press("Escape");
  await bubble.click();
  await header.click({ button: "right", position: { x: 24, y: 12 } });
  await page.getByRole("menuitem", { name: "Move freely", exact: true }).click();
  await expect.poll(() => panel.boundingBox()).toEqual(saved);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 600, height: 500 });
  await expect
    .poll(async () => {
      const bounds = (await panel.boundingBox())!;
      return bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 600 && bounds.y + bounds.height <= 500;
    })
    .toBe(true);
  await expect(panel.getByRole("button", { name: "Close Side Panel", exact: true })).toBeInViewport();
  await page.setViewportSize(viewport);
  await expect.poll(() => panel.boundingBox()).toEqual(saved);
  await header.click({ button: "right", position: { x: 24, y: 12 } });
  await page.getByRole("menuitem", { name: "Snap to alignment", exact: true }).click();
  await expect
    .poll(async () => {
      const bounds = (await panel.boundingBox())!;
      return bounds.x + bounds.width / 2;
    })
    .toBeGreaterThan((viewport.width * 2) / 3);
  await expect(draft).toContainText("Keep this draft through free movement and resizing");
};
