import type { ProjectCloudState } from "./cloud-project-states";

/** The picker's second line: where the project is on this device. */
export const projectLocationKey = (folderPath: string | null, state: ProjectCloudState) => {
  if (state.cloud) {
    if (folderPath) return { key: "path", path: folderPath } as const;
    if (!state.sync || state.sync.state === "first-download-incomplete")
      return { key: "list.cloudDownloading" } as const;
    return { key: state.sync.offlineReady ? "list.cloudReady" : "list.cloudNoFolder" } as const;
  }
  if (!folderPath) return { key: "list.noFolder" } as const;
  return state.signedIn
    ? ({ key: "list.localPath", path: folderPath } as const)
    : ({ key: "path", path: folderPath } as const);
};
