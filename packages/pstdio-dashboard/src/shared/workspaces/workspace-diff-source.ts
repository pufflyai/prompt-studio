import { getRuntimeApiClient } from "@/lib/api";
import type { RuntimeCollections } from "@/lib/sync/collections";

const wait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });

/** One optional watch per active query. A new lease waits for watch admission before reading. */
export const createWorkspaceDiffSource = (
  owner: RuntimeCollections,
  workspaceId: string,
  projectId: string,
  invalidate: () => void,
) => {
  const abort = new AbortController();
  const ready = Promise.withResolvers<void>();
  let joined = false;
  const run = async () => {
    let retryMs = 1_000;
    while (!abort.signal.aborted) {
      try {
        await getRuntimeApiClient(owner).workspaces.watchDiff(workspaceId, {
          projectId,
          signal: abort.signal,
          onReady() {
            ready.resolve();
            if (joined) invalidate();
            joined = true;
            retryMs = 1_000;
          },
          onChange: invalidate,
        });
        if (!abort.signal.aborted) await wait(0, abort.signal);
      } catch {
        // A disconnected watch must not prevent the independent finite read or own an idle timer.
        ready.resolve();
        if (!abort.signal.aborted) await wait(retryMs, abort.signal);
        retryMs = Math.min(retryMs * 2, 30_000);
      }
    }
  };
  void run();
  return {
    ready: ready.promise,
    close() {
      abort.abort();
      ready.resolve();
    },
  };
};
