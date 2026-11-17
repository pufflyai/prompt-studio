import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { placementIndexes } from "../timeline/commands/placement-indexes";
import { attemptQueryIndexes } from "./attempt-queries";
import { autoBuildDispatchIndex } from "./auto-build-dispatches";
import { reviewRequestLinkIndexes } from "./auto-build-request-links";
import { definitionIndexes, legacyCleanupIndexes } from "./definition-query";
import { mergeTicketIndex } from "./merge-ticket-query";
import { plannerNavigationIndexes } from "./navigation-queries";
import { reviewQueryIndexes } from "./review-query-indexes";
import { reviewThreadIndex } from "./review-thread-page";
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
  ...legacyCleanupIndexes,
  mergeTicketIndex,
  autoBuildDispatchIndex,
  ...reviewRequestLinkIndexes,
  reviewThreadIndex,
];
export const preparePlannerIndexes = (storage: ExtensionStorageApi) =>
  storage.records.defineIndexes(plannerStorageIndexes());
