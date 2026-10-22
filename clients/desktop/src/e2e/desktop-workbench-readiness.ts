import type { Page } from "@playwright/test";

export const watchWorkbenchPage = (lifecyclePage: Page, origin: string) => {
  const context = lifecyclePage.context();
  const ready = Promise.withResolvers<Page>();
  const pages = new Map<Page, () => void>();
  const watch = (page: Page) => {
    if (page === lifecyclePage) return;
    const check = () => {
      const url = new URL(page.url());
      if (url.origin === origin) ready.resolve(page);
    };
    pages.set(page, check);
    page.on("framenavigated", check);
    check();
  };
  context.on("page", watch);
  for (const page of context.pages()) watch(page);
  return {
    ready: ready.promise,
    stop: () => {
      context.off("page", watch);
      for (const [page, check] of pages) page.off("framenavigated", check);
    },
  };
};

export const watchLifecycleRecovery = (page: Page) => {
  const key = `recovery-${crypto.randomUUID()}`;
  const ready = page
    .evaluate(
      (key) =>
        new Promise<string | null>((resolve) => {
          const storage = window as unknown as Record<string, { stop: () => void }>;
          const finish = (message: string | null) => {
            observer.disconnect();
            delete storage[key];
            resolve(message);
          };
          const check = () => {
            const headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]");
            const heading = Array.from(headings).find((node) => node.textContent === "Prompt Studio needs attention");
            if (
              heading instanceof HTMLElement &&
              heading.getClientRects().length > 0 &&
              getComputedStyle(heading).visibility !== "hidden"
            )
              finish(heading.parentElement?.innerText ?? heading.innerText);
          };
          const observer = new MutationObserver(check);
          storage[key] = { stop: () => finish(null) };
          observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
          check();
        }),
      key,
    )
    .then((message) => {
      if (message === null) throw new Error("Recovery observation stopped");
      throw new Error(`Desktop startup failed: ${message}`);
    });
  return {
    ready,
    stop: async () => {
      if (page.isClosed()) return;
      await page.evaluate((key) => {
        (window as unknown as Record<string, { stop: () => void }>)[key]?.stop();
      }, key);
    },
  };
};
