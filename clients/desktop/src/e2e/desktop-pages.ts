import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { LIFECYCLE_URL } from "../windows/lifecycle-protocol";
import { watchLifecycleRecovery, watchWorkbenchPage } from "./desktop-workbench-readiness";

export const waitForLifecyclePage = async (context: BrowserContext) => {
  const findLifecycle = () => context.pages().find((page) => page.url() === LIFECYCLE_URL);
  // Startup can be slow on a first launch; the calling test owns the deadline.
  await expect.poll(findLifecycle, { timeout: test.info().timeout }).toBeDefined();
  return findLifecycle()!;
};

export const waitForWorkbenchPage = async (lifecyclePage: Page, origin: string) => {
  const workbench = watchWorkbenchPage(lifecyclePage, origin);
  const recovery = watchLifecycleRecovery(lifecyclePage);
  const renderedWorkbench = workbench.ready.then(async (page) => {
    await page.locator("#root:not(:empty)").waitFor({ state: "attached" });
    return page;
  });
  try {
    return await Promise.race([renderedWorkbench, recovery.ready]);
  } finally {
    workbench.stop();
    await recovery.stop();
  }
};
