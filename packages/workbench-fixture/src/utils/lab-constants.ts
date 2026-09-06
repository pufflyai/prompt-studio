import type { WhenExpression } from "@pstdio/sdk/extensions";

export const COUNTER_STORAGE_KEY = "counter";

export const LAB_ROUTE_HEADER_WHEN = {
  view: { extensionId: "pstdio.workbench-fixture", kind: "view", id: "lab-page" },
} satisfies WhenExpression;
