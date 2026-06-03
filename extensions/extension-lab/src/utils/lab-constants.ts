import type { WhenExpression } from "@pstdio/sdk/extensions";

export const COUNTER_STORAGE_KEY = "counter";

export const LAB_ROUTE_HEADER_WHEN = {
  resourceType: ["extension-route"],
  metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
} satisfies WhenExpression;
