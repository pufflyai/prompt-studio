import { expect, test } from "bun:test";
import { runDesktopDevelopment } from "./dev-desktop-runner";

test("preserves the startup failure when isolated stack cleanup also fails", async () => {
  const cleanupFailures: unknown[] = [];
  const startupFailure = new Error("Electron failed to start");

  expect(
    runDesktopDevelopment({
      start: async () => {
        throw startupFailure;
      },
      stop: () => {
        throw new Error("Docker cleanup failed");
      },
      reportCleanupFailure: (error) => cleanupFailures.push(error),
    }),
  ).rejects.toBe(startupFailure);
  expect(cleanupFailures).toHaveLength(1);
});
