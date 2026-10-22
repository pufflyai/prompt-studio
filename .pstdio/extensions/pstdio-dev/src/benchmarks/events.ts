import { eventRef } from "@pstdio/sdk/extensions";

// Shared by the backend and webviews, so it stays free of Node imports.
export const benchmarksChanged = eventRef<{ runId?: string }>({
  extensionId: "pstdio.pstdio-dev",
  id: "benchmarks.changed",
});
