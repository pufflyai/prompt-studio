import type { WebviewClient, WebviewPerformanceClient } from "@pstdio/sdk/extensions";

interface SnapshotClient {
  queries: WebviewClient<object>["queries"];
  performance: Pick<WebviewPerformanceClient, "snapshot" | "subscribe">;
}

/** Observe the host's measurement cadence; a listener never starts another collector. */
export const createSnapshotQuery = (client: SnapshotClient) => {
  const query = client.queries.query({
    id: "performance.snapshot",
    scope: { projectId: undefined },
    read: () => client.performance.snapshot(),
    subscribe: () => {
      let active = true;
      let pushed = false;
      const stopping = client.performance.subscribe((snapshot) => {
        pushed = true;
        if (active) query.accept(snapshot);
      });
      // A prepared snapshot has no live cursor. Subscribe first, then reconcile that gap.
      if (!pushed) query.invalidate();
      void stopping.catch((cause) => {
        if (active) query.reportError(cause);
      });
      return () => {
        active = false;
        void stopping.then((stop) => stop()).catch(() => {});
      };
    },
  });
  return query;
};
