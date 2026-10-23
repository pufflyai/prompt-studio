import type { Page } from "@playwright/test";

/** Measure the user action through painted rows, excluding automation locator work. */
export const observeCollectionReadiness = async (page: Page, kind: "table" | "board", owner: number) => {
  await page.evaluate(
    ({ kind, owner }) => {
      const target = window as typeof window & { collectionReadiness?: Promise<number> };
      target.collectionReadiness = new Promise<number>((resolve) => {
        document.addEventListener(
          "pointerdown",
          () => {
            const started = performance.now();
            const title = `paged-owner-${owner} row `;
            let painting = false;
            const selector = kind === "table" ? "table tbody td" : '[data-testid="renderer-card"]';
            const needle = kind === "table" ? title : `${title}0001`;
            const matches = (element: HTMLElement) => element.textContent?.includes(needle);
            const check = () => {
              const rows = [...document.querySelectorAll<HTMLElement>(selector)].filter(matches);
              const first = rows[0];
              if (!first || (kind === "table" && rows.length !== 100) || !first.checkVisibility() || painting) return;
              if (first.closest('[aria-busy="true"]')) return;
              if (
                kind === "board" &&
                first.closest('[data-testid="kanban-renderer"]')?.querySelector("button:disabled")
              )
                return;
              painting = true;
              observer.disconnect();
              requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - started)));
            };
            const observer = new MutationObserver(check);
            observer.observe(document.body, { childList: true, subtree: true, attributes: true });
            check();
          },
          { once: true, capture: true },
        );
      });
    },
    { kind, owner },
  );
  return () =>
    page.evaluate(() => (window as typeof window & { collectionReadiness: Promise<number> }).collectionReadiness);
};
