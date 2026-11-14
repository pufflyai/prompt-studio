import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { attemptQueryIndexes } from "./attempt-queries";
import { plannerNavigationIndexes } from "./navigation-queries";
import { ticketSelectionIndexes } from "./ticket-selection";

// defineIndexes replaces the owner's declaration. Every entry point must install the same set.
export const plannerStorageIndexes = () => [
  ...plannerNavigationIndexes,
  ...ticketSelectionIndexes,
  ...attemptQueryIndexes,
];
export const preparePlannerIndexes = (storage: ExtensionStorageApi) =>
  storage.records.defineIndexes(plannerStorageIndexes());
