import type { Page } from "@playwright/test";

export const waitForVisibleElement = async (page: Page, selector: string, text?: string) => {
  // Timestamp the visible frame before assertion polling and trace capture add latency.
  const visibleAt = await page.waitForFunction(
    ({ selector, text }) => {
      if (document.visibilityState !== "visible") return false;
      const element = document.querySelector<HTMLElement>(selector);
      if (!element?.checkVisibility({ visibilityProperty: true }) || (text && element.textContent !== text))
        return false;
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 ? Date.now() : false;
    },
    { selector, text },
    { polling: "raf" },
  );
  const timestamp = await visibleAt.jsonValue();
  await visibleAt.dispose();
  if (timestamp === false) throw new Error("Expected a visible element timestamp");
  return timestamp;
};
