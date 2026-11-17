import { AsyncLocalStorage } from "node:async_hooks";
import { availableParallelism } from "node:os";

export const preparationBuildConcurrency = Math.max(1, Math.min(4, availableParallelism()));
const buildCommand = new AsyncLocalStorage<boolean>();
export const withPreparationBuildCommand = <T>(work: () => T) => buildCommand.run(true, work);
export const isPreparationBuildCommand = () => buildCommand.getStore() === true;

// This module's host instance owns all worker-spawned build/inspector children.
// Only leaves acquire a permit; nested orchestration never holds one.
let active = 0;
const waiting: (() => void)[] = [];
export const acquirePreparationBuildCommand = (signal: AbortSignal, waitingChanged: (waiting: boolean) => void) =>
  new Promise<() => void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      const index = waiting.indexOf(enter);
      if (index >= 0) {
        waiting.splice(index, 1);
        waitingChanged(false);
      }
      reject(signal.reason);
    };
    let queued = false;
    const enter = () => {
      signal.removeEventListener("abort", abort);
      active++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        active--;
        waiting.shift()?.();
      });
      // Ownership and abort-listener removal must precede the scheduler callback:
      // it may synchronously retire this worker and abort the command.
      if (queued) waitingChanged(false);
    };
    if (active < preparationBuildConcurrency) enter();
    else {
      queued = true;
      waiting.push(enter);
      signal.addEventListener("abort", abort, { once: true });
      waitingChanged(true);
    }
  });
