import type { WhenExpression } from "@pstdio/sdk/extensions";

export const COUNTER_STORAGE_KEY = "counter";

export const LAB_ROUTE_HEADER_WHEN = {
  view: { extensionId: "pstdio.extension-lab", kind: "view", id: "lab-page" },
} satisfies WhenExpression;
