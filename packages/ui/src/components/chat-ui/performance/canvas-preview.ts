import { expect, type Page } from "@playwright/test";

export const openPerformancePreview = async (page: Page, variant: string) => {
  const id = `ui-${variant}`;
  await page.goto(`/?preview=${encodeURIComponent(id)}`);
  const shell = page.frameLocator("[data-verification-host]");
  const panel = shell.locator(`[data-canvas-item="${id}"]`);
  await expect(panel.locator("iframe")).toHaveAttribute("data-frame-ready", "true");
  await panel.getByRole("button", { name: /^Select / }).click();
  const element = await panel.locator("iframe").elementHandle();
  return (await element!.contentFrame())!;
};
