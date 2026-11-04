import type { PerformanceSnapshot, WebviewPerformanceClient } from "@pstdio/sdk/extensions";

// Follows the host's shared snapshot polling. Subscribing adds a listener only, so
// nothing is measured while monitoring is off and the latest value stays null.
export const createSnapshotStore = (performance: Pick<WebviewPerformanceClient, "snapshot" | "subscribe">) => {
  // Undefined until the first reading arrives; null while monitoring is off.
  let snapshot: PerformanceSnapshot | null | undefined;
  // Why the host could not be read; cleared by the next snapshot it sends.
  let error: string | undefined;
  const listeners = new Set<() => void>();
  let stop: Promise<() => Promise<void>> | undefined;
  let revision = 0;
  let readVersion = 0;
  const publish = (next: PerformanceSnapshot | null, failure?: string) => {
    revision++;
    snapshot = next;
    error = failure;
    for (const listener of listeners) listener();
  };
  const refresh = () => {
    const request = ++readVersion;
    const startedAt = revision;
    void performance.snapshot().then(
      (initial) => {
        if (revision === startedAt && request === readVersion) publish(initial);
      },
      (cause) => {
        if (revision === startedAt && request === readVersion) publish(snapshot ?? null, String(cause));
      },
    );
  };
  // Prepare one reading before opening; live subscriptions belong to visible effects.
  refresh();
  return {
    get: () => snapshot,
    getError: () => error,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!stop) {
        refresh();
        stop = performance.subscribe(publish);
        void stop.catch((cause) => publish(snapshot ?? null, String(cause)));
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || !stop) return;
        const stopping = stop;
        stop = undefined;
        void stopping.then((dispose) => dispose()).catch(() => {});
      };
    },
  };
};

export type SnapshotStore = ReturnType<typeof createSnapshotStore>;
