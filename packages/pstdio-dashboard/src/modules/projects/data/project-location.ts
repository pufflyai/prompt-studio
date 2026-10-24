import type { ProjectCloudState } from "./cloud-project-states";

// The sync state has no byte progress, so the first download shows as "not on this device yet" until it is done.
const cloudLocationKey = (state: ProjectCloudState) => {
  if (!state.sync) return "list.cloud";
  if (state.sync.state === "first-download-incomplete") return "list.cloudNotOnDevice";
  if (state.sync.state === "needs-attention") return "list.cloudNeedsAttention";
  if (state.sync.offlineReady) return "list.cloudReady";
  return "list.cloudWaiting";
};

/** The picker's second line: where the project is on this device. */
export const projectLocationKey = (folderPath: string | null, state: ProjectCloudState) => {
  if (state.cloud) {
    if (folderPath) return { key: "path", path: folderPath } as const;
    return { key: cloudLocationKey(state) } as const;
  }
  if (!folderPath) return { key: "list.noFolder" } as const;
  return state.signedIn
    ? ({ key: "list.localPath", path: folderPath } as const)
    : ({ key: "path", path: folderPath } as const);
};
