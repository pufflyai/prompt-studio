import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { LIFECYCLE_URL } from "../windows/lifecycle-protocol";

export const waitForLifecyclePage = async (context: BrowserContext) => {
  const findLifecycle = () => context.pages().find((page) => page.url() === LIFECYCLE_URL);
  // Startup can be slow on a first launch; the calling test owns the deadline.
  await expect.poll(findLifecycle, { timeout: test.info().timeout }).toBeDefined();
  return findLifecycle()!;
};

export const waitForWorkbenchPage = async (lifecyclePage: Page, origin: string) => {
  const context = lifecyclePage.context();
  const page = context.pages().find((candidate) => candidate !== lifecyclePage) ?? (await context.waitForEvent("page"));
  await page.waitForURL((url) => url.origin === origin && url.pathname === "/", { waitUntil: "commit" });
  return page;
};
