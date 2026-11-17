import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { attemptQueryIndexes } from "./attempt-queries";
import { migratePlannerStorage } from "./migrate-storage";
import { plannerNavigationIndexes } from "./navigation-queries";
import { ticketSelectionIndexes } from "./ticket-selection";

// defineIndexes replaces the owner's declaration. Every entry point must install the same set.
export const plannerStorageIndexes = () => [
  ...plannerNavigationIndexes,
  ...ticketSelectionIndexes,
  ...attemptQueryIndexes,
];
// Queries must not run before an older project's tickets have moved into the indexed records.
export const preparePlannerIndexes = async (storage: ExtensionStorageApi) => {
  await migratePlannerStorage({ storage });
  await storage.records.defineIndexes(plannerStorageIndexes());
};
