import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { resolveDashboardStorage } from "./dashboard-storage";

let durable: WorkbenchStorageLike | undefined;

/** Desktop browser storage ends at quit; the desktop app supplies storage that survives a restart. */
export const keepDashboardChatDraftsIn = (storage: WorkbenchStorageLike | undefined) => {
  durable = storage;
};

/** Where every native chat view and draft seed keeps its conversation drafts. */
export const dashboardChatDraftStorage = () => resolveDashboardStorage(durable);
