import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { buildAbsoluteApiUrl } from "@/lib/api";
import { resolveDashboardStorage } from "./dashboard-storage";

let desktop: WorkbenchStorageLike | undefined;

/** Desktop browser storage ends at quit; the desktop app supplies storage that survives a restart. */
export const keepDashboardChatDraftsIn = (storage: WorkbenchStorageLike | undefined) => {
  desktop = storage;
};

/** Where every native chat view and draft seed keeps its conversation drafts. */
export const dashboardChatDraftStorage = () => resolveDashboardStorage(desktop);

/**
 * Separates drafts of different runtimes that share browser storage. The desktop runtime
 * listens on a new port at every launch, so its drafts use one fixed scope instead.
 */
export const dashboardChatDraftScope = () => (desktop ? "desktop" : buildAbsoluteApiUrl("/"));
