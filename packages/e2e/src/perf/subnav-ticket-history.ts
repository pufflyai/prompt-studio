import { expect, type Locator, type Page } from "@playwright/test";

/** Retained history need not issue another response; verify all rows remain reachable. */
export const readSubnavTicketHistory = async (page: Page, sidenav: Locator) => {
  const seen = new Set<string>();
  const viewports = sidenav.locator('[data-scope="scroll-area"][data-part="viewport"]');
  const painted = () =>
    page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  const reset = () =>
    viewports.evaluateAll((elements) => {
      for (const viewport of elements) if (viewport.checkVisibility()) viewport.scrollTop = 0;
    });
  await reset();
  await painted();
  try {
    await expect
      .poll(async () => {
        const names = await sidenav
          .locator("[data-tree-list-node-id]")
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => node.checkVisibility())
              .flatMap((node) => node.textContent?.match(/Benchmark session \d{4}/g) ?? []),
          );
        for (const name of names) seen.add(name);
        if (seen.size === 120) return seen.size;
        await viewports.evaluateAll((elements) => {
          for (const viewport of elements)
            if (viewport.checkVisibility()) viewport.scrollTop += viewport.clientHeight * 0.75;
        });
        await painted();
        return seen.size;
      })
      .toBe(120);
    expect([...seen].sort()).toEqual(
      Array.from({ length: 120 }, (_, id) => `Benchmark session ${String(id + 1).padStart(4, "0")}`),
    );
    return seen.size;
  } finally {
    await reset();
    await painted();
  }
};
