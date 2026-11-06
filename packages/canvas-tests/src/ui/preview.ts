import { expect, type Page } from "@playwright/test";

export const openCanvasPreview = async (page: Page, id: string, example?: string) => {
  await page.goto(`/?frame=${encodeURIComponent(id)}`);
  const shell = page.frameLocator("[data-verification-host]");
  const panel = shell.locator(`[data-canvas-item="${id}"]`);
  await expect(panel.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await panel.getByRole("button", { name: /^Select / }).click();
  // Selecting a frame opens its editor through the normal split-panel motion. Fit only after
  // that layout completes; otherwise each geometry read can observe a different camera position.
  await shell.locator("[data-canvas-viewport]").evaluate(async (element) => {
    await Promise.all(
      element.ownerDocument
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await shell.locator("[data-canvas-viewport]").press("f");
  // Runtime fitting batches the camera paint through requestAnimationFrame.
  await shell
    .locator("[data-canvas-stage]")
    .evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  const preview = panel.frameLocator("iframe");
  if (example) {
    await preview.getByRole("button", { name: "Choose example", exact: true }).click();
    await preview.getByRole("menuitem", { name: example, exact: true }).click();
  }
  return preview;
};
