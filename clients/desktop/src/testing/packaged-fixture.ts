import { type SpawnOptionsWithoutStdio, spawn } from "node:child_process";
import { test as base, type TestInfo } from "@playwright/test";

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
      if (errors.length) throw new AggregateError(errors, "Could not clean up packaged test resources");
    },
    { auto: true },
  ],
});

export const registerPackagedCleanup = (cleanup: () => void | Promise<void>) => {
  cleanups.get(base.info())!.push(cleanup);
};

export const spawnPackagedProcess = (command: string, args: string[], options: SpawnOptionsWithoutStdio) => {
  const child = spawn(command, args, { ...options, detached: process.platform !== "win32" });
  registerPackagedCleanup(async () => {
    if (child.pid === undefined) return;
    const exited =
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
    try {
      if (process.platform === "win32") child.kill("SIGKILL");
      else process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    await exited;
  });
  return child;
};
