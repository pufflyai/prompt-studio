import type { WebviewPerformanceClient } from "@pstdio/sdk/extensions";
/** The window controller owns accepted measurements, errors, sampling and capture leases. */
export const createSnapshotQuery = (client: { performance: Pick<WebviewPerformanceClient, "query"> }) =>
  client.performance.query();
