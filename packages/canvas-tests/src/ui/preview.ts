import { expect, type Page } from "@playwright/test";

export const openCanvasPreview = async (page: Page, id: string) => {
  await page.goto(`/?preview=${encodeURIComponent(id)}`);
  const shell = page.frameLocator("[data-verification-host]");
  const panel = shell.locator(`[data-canvas-item="${id}"]`);
  await expect(panel.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await panel.getByRole("button", { name: /^Select / }).click();
  return panel.frameLocator("iframe");
};
