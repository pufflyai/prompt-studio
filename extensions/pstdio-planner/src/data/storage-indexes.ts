import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { placementIndexes } from "../timeline/commands/placement-indexes";
import { attemptQueryIndexes } from "./attempt-queries";
import { definitionIndexes } from "./definition-query";
import { migratePlannerStorage } from "./migrate-storage";
import { plannerNavigationIndexes } from "./navigation-queries";
import { reviewQueryIndexes } from "./review-query-indexes";
import { ticketSelectionIndexes } from "./ticket-selection";
import { ticketViewIndex } from "./ticket-view-index";

// defineIndexes replaces the owner's declaration. Every entry point must install the same set.
export const plannerStorageIndexes = () => [
  ...plannerNavigationIndexes,
  ...ticketSelectionIndexes,
  ...attemptQueryIndexes,
  ...reviewQueryIndexes,
  ...placementIndexes,
  ticketViewIndex,
  ...definitionIndexes,
  ...["workspace-status-definitions", "workspace-status-values"].map((collection) => ({
    name: `cleanup:${collection}`,
    collection,
    fields: { id: { path: ["id"], type: "string" as const } },
  })),
];
// Queries must not run before an older project's tickets have moved into the indexed records.
const prepared = new WeakMap<ExtensionStorageApi, Promise<void>>();
export const preparePlannerIndexes = (storage: ExtensionStorageApi) => {
  const existing = prepared.get(storage);
  if (existing) return existing;
  // The declaration is fixed for this runtime. Reinstalling it for every evidence
  // read repeats validation and index setup for every ticket in a candidate page.
  const ready = (async () => {
    await migratePlannerStorage({ storage });
    await storage.records.defineIndexes(plannerStorageIndexes());
  })().catch((error: unknown) => {
    prepared.delete(storage);
    throw error;
  });
  prepared.set(storage, ready);
  return ready;
};
