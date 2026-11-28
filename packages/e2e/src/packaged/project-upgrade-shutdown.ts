import type { ChildProcess } from "node:child_process";
import { ownedDescendants, signalDescendants } from "pstdio-scripts/owned-process-tree";
import { stopProcess } from "./packaged-serve-helpers";

const stops = new WeakMap<ChildProcess, Promise<void>>();

// A definition reader can outlive its host and hold its stdio open after shutdown.
export const stopUpgradeProcess = (child: ChildProcess, timeoutMs = 60_000) => {
  const pending = stops.get(child);
  if (pending) return pending;
  const descendants =
    child.pid && child.exitCode === null && child.signalCode === null ? ownedDescendants(child.pid) : [];
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Upgrade host ${child.pid} did not close within ${timeoutMs} ms of shutdown`));
      try {
        signalDescendants(descendants, "SIGKILL");
      } catch (error) {
        console.error("Could not clean up all upgrade fixture descendants", error);
      } finally {
        child.kill("SIGKILL");
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
      }
    }, timeoutMs);
  });
  const stopped = Promise.race([stopProcess(child), expired]).finally(() => clearTimeout(timer));
  stops.set(child, stopped);
  return stopped;
};
