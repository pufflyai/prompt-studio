import { test as base } from "@playwright/test";
import { stopPendingTestProcesses } from "./pending-test-processes";

export * from "@playwright/test";

export const test = base.extend<{ _pendingProcesses: undefined }>({
  _pendingProcesses: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads this pattern to find fixture dependencies.
    async ({}, use) => {
      try {
        await use(undefined);
      } finally {
        await stopPendingTestProcesses();
      }
    },
    { auto: true },
  ],
});
