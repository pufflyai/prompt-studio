import { expect, type Page } from "@playwright/test";

export const openPerformancePreview = async (page: Page, variant: string) => {
  const id = `ui-${variant}`;
  const viewport = page.viewportSize()!;
  await page.goto(
    `/?preview=${encodeURIComponent(id)}&viewport-width=${viewport.width}&viewport-height=${viewport.height}`,
  );
  const shell = page.frameLocator("[data-verification-host]");
  const panel = shell.locator(`[data-canvas-item="${id}"]`);
  await expect(panel.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await panel.getByRole("button", { name: /^Select / }).click();
  const element = await panel.locator("iframe").elementHandle();
  const frame = (await element!.contentFrame())!;
  // Preserve the browser viewport used by the original fixed performance workloads.
  expect(await frame.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(viewport);
  return frame;
};
