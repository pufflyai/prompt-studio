import type { Page, TestInfo } from "@playwright/test";
import { homeFrame } from "../../helpers/home-loading";
import { expect } from "../../scripts/session-test";

// Critical risk: moving and resizing a live Side iframe must keep its draft and controls reachable.
export const verifyFreeFloatingSidePanel = async (page: Page, info: TestInfo) => {
  const bubble = page.getByRole("button", { name: "Open Side Panel", exact: true });
  await bubble.click();
  const panel = page.getByTestId("workbench-side-panel-floating");
  const header = panel.locator('[data-workbench-panel-header="side"]');
  const openHeaderMenu = async () => {
    const bounds = (await header.boundingBox())!;
    await header.click({ button: "right", position: { x: bounds.width * 0.65, y: bounds.height / 2 } });
  };
  const draft = panel.getByTestId("content-editable").filter({ visible: true });
  await draft.fill("Keep this draft through free movement and resizing");
  const initial = (await panel.boundingBox())!;
  const topLeftHandle = panel.getByRole("button", { name: "Resize Side Panel from top left", exact: true });
  await expect(topLeftHandle).toBeVisible();
  await expect(panel.locator("[data-resize-direction]")).toHaveCount(1);
  const topLeft = (await topLeftHandle.boundingBox())!;
  await page.mouse.move(topLeft.x + topLeft.width / 2, topLeft.y + topLeft.height / 2);
  await page.mouse.down();
  await page.mouse.move(topLeft.x + topLeft.width / 2 + 96, topLeft.y + topLeft.height / 2 + 160, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(initial.width - 96, 0);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeCloseTo(initial.height - 160, 0);
  await openHeaderMenu();
  await page.getByRole("menuitem", { name: "Move freely", exact: true }).click();
  await expect(panel).toHaveAttribute("data-floating-panel-movement", "free");
  const beforeMove = (await panel.boundingBox())!;
  const grip = (await header.boundingBox())!;
  await page.mouse.move(grip.x + grip.width * 0.65, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width * 0.65 - 180, grip.y + grip.height / 2 - 96, { steps: 8 });
  await expect(page.locator("[data-side-panel-drop-slot]")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.x).toBeCloseTo(beforeMove.x - 180, 0);
  await expect.poll(async () => (await panel.boundingBox())!.y).toBeCloseTo(beforeMove.y - 96, 0);
  const beforeCancel = (await panel.boundingBox())!;
  const cancelGrip = (await header.boundingBox())!;
  await page.mouse.move(cancelGrip.x + cancelGrip.width * 0.65, cancelGrip.y + cancelGrip.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelGrip.x + cancelGrip.width * 0.65 - 32, cancelGrip.y + cancelGrip.height / 2 - 24, {
    steps: 4,
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => panel.boundingBox()).toEqual(beforeCancel);
  const beforeResize = (await panel.boundingBox())!;
  const handle = (await topLeftHandle.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 64, handle.y + handle.height / 2 - 48, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeCloseTo(beforeResize.width + 64, 0);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeCloseTo(beforeResize.height + 48, 0);
  const beforeKey = (await panel.boundingBox())!;
  await topLeftHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(beforeKey.width);
  const beforeResizeCancel = (await panel.boundingBox())!;
  const cancelHandle = (await topLeftHandle.boundingBox())!;
  await page.mouse.move(cancelHandle.x + cancelHandle.width / 2, cancelHandle.y + cancelHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelHandle.x + 32, cancelHandle.y + 24, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect.poll(() => panel.boundingBox()).toEqual(beforeResizeCancel);
  await expect(draft).toContainText("Keep this draft through free movement and resizing");
  await page.screenshot({ path: info.outputPath("free-floating-panel.png") });
  const saved = (await panel.boundingBox())!;
  await panel.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await bubble.click();
  await expect.poll(() => panel.boundingBox()).toEqual(saved);
  await panel.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await page.reload();
  await expect(homeFrame(page).getByText("Free floating Side Panel", { exact: true })).toBeVisible();
  await expect(bubble).toBeVisible();
  await bubble.click();
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.boundingBox()).toEqual(saved);
  await panel.getByRole("button", { name: "Close Side Panel", exact: true }).click();
  await page.getByRole("option", { name: "Settings", exact: true }).click();
  await page.getByRole("option", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: "Move freely", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Snap to alignment", exact: true }).click();
  await expect(panel).toHaveAttribute("data-floating-panel-movement", "snap");
  await page.keyboard.press("Escape");
  await bubble.click();
  await openHeaderMenu();
  await page.getByRole("menuitem", { name: "Move freely", exact: true }).click();
  await expect(panel).toHaveAttribute("data-floating-panel-movement", "free");
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
  await openHeaderMenu();
  await page.getByRole("menuitem", { name: "Snap to alignment", exact: true }).click();
  await expect
    .poll(async () => {
      const bounds = (await panel.boundingBox())!;
      return bounds.x + bounds.width / 2;
    })
    .toBeGreaterThan((viewport.width * 2) / 3);
  await expect(draft).toContainText("Keep this draft through free movement and resizing");
  await page.setViewportSize({ width: 360, height: 500 });
  await openHeaderMenu();
  await page.getByRole("menuitem", { name: "Align center", exact: true }).click();
  await expect
    .poll(async () => {
      const bounds = (await panel.boundingBox())!;
      return bounds.x + bounds.width / 2;
    })
    .toBeCloseTo(180, 0);
};
