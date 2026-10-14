import type { PlacementItem } from "@pstdio/sdk/extensions";

/** Only the extension host opts into the deprecated tab lock contract. */
export const adaptPlacementItem = (item: PlacementItem, tabLocks?: "legacy") =>
  item.kind === "view" && item.presence === "fixed" && tabLocks !== "legacy"
    ? { ...item, presence: "open" as const }
    : { ...item };
