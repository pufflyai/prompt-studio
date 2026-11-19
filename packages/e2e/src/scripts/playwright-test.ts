import { relative, resolve } from "node:path";
import { test as base } from "@playwright/test";
import { matchesPlatform, quarantineRegistry } from "pstdio-scripts/testing";
import { stopPendingTestProcesses } from "./pending-test-processes";

export * from "@playwright/test";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

export const test = base.extend<{ _pendingProcesses: undefined }>({
  _pendingProcesses: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright reads this pattern to find fixture dependencies.
    async ({}, use, info) => {
      const file = relative(repositoryRoot, info.file).replaceAll("\\", "/");
      // Keep the exact case in the stable runner's inventory. Its own quarantine run executes it.
      if (process.env.E2E_TEST_LANE !== "quarantine")
        info.skip(
          quarantineRegistry.some(
            (entry) =>
              entry.runner === "playwright" &&
              entry.file === file &&
              entry.name === info.title &&
              matchesPlatform(entry, process.platform, process.arch),
          ),
          "Registered quarantine case",
        );
      try {
        await use(undefined);
      } finally {
        await stopPendingTestProcesses();
      }
    },
    { auto: true },
  ],
});
