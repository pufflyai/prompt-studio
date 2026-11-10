import type { Locator, Page } from "@playwright/test";

const revealRenderedEntry = (entry: Locator) =>
  entry.evaluateAll((elements) => {
    const element = elements[0];
    if (!(element instanceof HTMLElement)) return false;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height || getComputedStyle(element).visibility !== "visible") return false;
    // Resolve and scroll in one browser operation: virtualization may recycle the row between locator calls.
    element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    return true;
  });

// Virtual rows must be scrolled into the rendered window before locator actions can find them.
export const revealTreeEntry = async (page: Page, tree: Locator, entry: Locator) => {
  const viewports = tree.locator('[data-scope="scroll-area"][data-part="viewport"]');
  if (await revealRenderedEntry(entry)) return true;
  for (let index = 0; index < (await viewports.count()); index++) {
    const viewport = viewports.nth(index);
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    for (;;) {
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      if (await revealRenderedEntry(entry)) return true;
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
