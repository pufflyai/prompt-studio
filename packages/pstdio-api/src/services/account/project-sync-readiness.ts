import type { ProjectSyncStatus } from "pstdio-api-contracts";

export const initialProjectSyncStatus = async (_projectId: string) => ({
  state: "first-download-incomplete" as const,
  offlineReady: false,
});

// A downloaded owner is not ready for offline use until missing-project setup finishes.
export const recoveringProjectSyncStatus = (status: ProjectSyncStatus) => ({
  ...status,
  state: status.state === "needs-attention" ? status.state : ("first-download-incomplete" as const),
  offlineReady: false,
});
