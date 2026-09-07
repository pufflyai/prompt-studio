import type { Page } from "@playwright/test";

export const waitForWorkbenchPage = async (lifecyclePage: Page, origin: string) => {
  const context = lifecyclePage.context();
  const page = context.pages().find((candidate) => candidate !== lifecyclePage) ?? (await context.waitForEvent("page"));
  await page.waitForURL(`${origin}/`, { waitUntil: "commit" });
  return page;
};
