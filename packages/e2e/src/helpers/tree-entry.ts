import type { Locator, Page } from "@playwright/test";

// Virtual rows must be scrolled into the rendered window before locator actions can find them.
export const revealTreeEntry = async (page: Page, tree: Locator, entry: Locator) => {
  const viewports = tree.locator('[data-scope="scroll-area"][data-part="viewport"]');
  if (await entry.isVisible()) {
    await entry.scrollIntoViewIfNeeded();
    return true;
  }
  for (let index = 0; index < (await viewports.count()); index++) {
    const viewport = viewports.nth(index);
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    for (;;) {
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      if (await entry.isVisible()) {
        await entry.scrollIntoViewIfNeeded();
        return true;
      }
      const moved = await viewport.evaluate((element) => {
        const before = element.scrollTop;
        element.scrollTop += Math.max(1, element.clientHeight / 2);
        return element.scrollTop !== before;
      });
      if (!moved) break;
    }
  }
  return false;
};
