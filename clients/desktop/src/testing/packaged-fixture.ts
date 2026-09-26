import { type SpawnOptionsWithoutStdio, spawn } from "node:child_process";
import { test as base, type TestInfo } from "@playwright/test";
import { stopPackagedProcess } from "./stop-packaged-process";

export { stopPackagedProcess } from "./stop-packaged-process";

const cleanups = new WeakMap<TestInfo, Array<() => void | Promise<void>>>();

export const test = base.extend<{ packagedResources: undefined }>({
  packagedResources: [
    async ({ browserName: _browserName }, use, info) => {
      const owned: Array<() => void | Promise<void>> = [];
      cleanups.set(info, owned);
      const errors: unknown[] = [];
      try {
        await use(undefined);
      } finally {
        // Fixture teardown still runs when a timed-out test body cannot reach its finally block.
        for (const cleanup of owned.reverse()) {
          try {
            await cleanup();
          } catch (error) {
            errors.push(error);
          }
        }
        cleanups.delete(info);
      }
      if (errors.length) {
        throw new AggregateError(errors, errors.map((error) => String(error)).join("\n"));
      }
    },
    { auto: true },
  ],
});

export const registerPackagedCleanup = (cleanup: () => void | Promise<void>) => {
  cleanups.get(base.info())!.push(cleanup);
};

export const spawnPackagedProcess = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => {
  const child = spawn(command, args, { ...options, detached: process.platform !== "win32" });
  registerPackagedCleanup(() => stopPackagedProcess(child));
  return child;
};
