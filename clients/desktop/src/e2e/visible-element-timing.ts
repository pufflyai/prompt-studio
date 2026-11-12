import type { Page } from "@playwright/test";

export const timeVisibleChange = async (
  page: Page,
  selector: string,
  text: string,
  change: () => Promise<void> | void,
) => {
  // Arm inside the renderer before the signal. A complete visible transition can
  // happen before the driver receives control again or installs an assertion.
  const observer = await page.evaluateHandle(
    ({ selector, text }) => {
      const samples: number[] = [];
      let frame = 0;
      let stopped = false;
      let record = (timestamp: number) => {
        samples.push(timestamp);
      };
      const stop = () => {
        stopped = true;
        cancelAnimationFrame(frame);
        mutations.disconnect();
        document.removeEventListener("visibilitychange", check);
      };
      const check = () => {
        if (stopped) return;
        const element = document.querySelector<HTMLElement>(selector);
        if (
          document.visibilityState === "visible" &&
          element?.checkVisibility({ visibilityProperty: true }) &&
          element.textContent === text
        ) {
          const bounds = element.getBoundingClientRect();
          if (bounds.width > 0 && bounds.height > 0) record(Date.now());
        }
      };
      const tick = () => {
        check();
        if (!stopped) frame = requestAnimationFrame(tick);
      };
      // A retained lifecycle renderer can stop receiving animation callbacks.
      // Observe DOM/visibility changes too, with the same text, CSS and bounds checks.
      const mutations = new MutationObserver(check);
      mutations.observe(document.documentElement, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      document.addEventListener("visibilitychange", check);
      frame = requestAnimationFrame(tick);
      return {
        after: (startedAt: number) =>
          new Promise<number>((resolve) => {
            const finish = (timestamp: number) => {
              stop();
              resolve(timestamp);
            };
            const captured = samples.find((timestamp) => timestamp >= startedAt);
            samples.length = 0;
            if (captured !== undefined) finish(captured);
            else
              record = (timestamp) => {
                if (timestamp >= startedAt) finish(timestamp);
              };
          }),
        stop,
      };
    },
    { selector, text },
  );
  const startedAt = Date.now();
  try {
    await change();
    const visibleAt = await observer.evaluate((observation, start) => observation.after(start), startedAt);
    return { startedAt, visibleAt };
  } finally {
    if (!page.isClosed()) {
      await observer.evaluate((observation) => observation.stop());
      await observer.dispose();
    }
  }
};

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
