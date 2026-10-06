import type { Locator } from "@playwright/test";

// Observe the original rows so even a one-frame removal is visible to the check.
export const observeTreeRows = async (tree: Locator, rows: Locator[]) => {
  const handles = await Promise.all(rows.map((row) => row.elementHandle()));
  const probe = await tree.evaluateHandle((element, watched) => {
    const removed = new Set<string>();
    const observer = new MutationObserver(() => {
      for (const row of watched) {
        if (row && !row.isConnected) removed.add(row.textContent ?? "");
      }
    });
    observer.observe(element, { childList: true, subtree: true });
    return { removed, observer };
  }, handles);
  return async () => {
    const removed = await probe.evaluate(({ removed, observer }) => {
      observer.disconnect();
      return [...removed];
    });
    await probe.dispose();
    await Promise.all(handles.map((handle) => handle?.dispose()));
    return removed;
  };
};
