import { type BrowserContext, expect, type Page } from "@playwright/test";
import { LIFECYCLE_URL } from "../windows/lifecycle-protocol";

export const waitForLifecyclePage = async (context: BrowserContext) => {
  const findLifecycle = () => context.pages().find((page) => page.url() === LIFECYCLE_URL);
  await expect.poll(findLifecycle).toBeDefined();
  return findLifecycle()!;
};

export const waitForWorkbenchPage = async (lifecyclePage: Page, origin: string) => {
  const context = lifecyclePage.context();
  const page = context.pages().find((candidate) => candidate !== lifecyclePage) ?? (await context.waitForEvent("page"));
  await page.waitForURL(`${origin}/`, { waitUntil: "commit" });
  return page;
};
