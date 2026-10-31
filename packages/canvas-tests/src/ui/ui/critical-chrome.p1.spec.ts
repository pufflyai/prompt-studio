import { expect, test } from "@playwright/test";
import { openCanvasPreview } from "../preview";

// Critical: run options must remain reachable above their containing dialog.
test("run option menus stay usable inside a dialog", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/param-editor/harness-param-editor.canvas.tsx#InsideDialog",
  );
  await expect(preview.getByRole("button", { name: "GPT-5.3 Codex", exact: true })).toBeVisible();
  await expect(preview.getByRole("button", { name: "PS-10_A1", exact: true })).toBeVisible();
  await expect(preview.getByText("Collaboration", { exact: true })).toHaveCount(0);
  await preview.getByRole("button", { name: "Medium", exact: true }).click();
  const option = preview.getByRole("menuitemradio", { name: "High", exact: true });
  await expect(option).toBeVisible();
  expect(
    await option.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return element.contains(
        element.ownerDocument.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
      );
    }),
  ).toBe(true);
  await option.click();
  await expect(preview.getByRole("button", { name: "High", exact: true })).toBeVisible();
  await expect(preview.getByRole("dialog", { name: "Run attempt", exact: true })).toBeVisible();
});

// Critical: native window controls must not obscure project tabs or panel controls.
test("title bar controls fit the native window reservation", async ({ page }) => {
  const preview = await openCanvasPreview(
    page,
    "packages/ui/src/components/tab-strip/window-title-bar.canvas.tsx#EmbeddedNativeGeometry",
  );
  const geometry = await preview.locator("[data-window-title-bar]").evaluate((element) => {
    const bar = element.getBoundingClientRect();
    const content = element.querySelector<HTMLElement>(".ps-window-title-bar__content")!.getBoundingClientRect();
    const actions = element.querySelector<HTMLElement>(".ps-window-title-bar__actions")!.getBoundingClientRect();
    return {
      left: content.left - bar.left,
      width: content.width,
      reservedLeft: bar.width * 0.1,
      reservedWidth: bar.width * 0.8,
      actionsRight: actions.right,
      contentRight: content.right,
    };
  });
  expect(geometry.left).toBeCloseTo(geometry.reservedLeft, 0);
  expect(geometry.width).toBeCloseTo(geometry.reservedWidth, 0);
  expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.contentRight);
  await preview.getByRole("button", { name: "Toggle Sidenav", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Toggle Sidenav", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await preview.getByRole("button", { name: "Close Project 1", exact: true }).click();
  await expect(preview.getByRole("tab", { name: "Project 1", exact: true })).toHaveCount(0);
});
