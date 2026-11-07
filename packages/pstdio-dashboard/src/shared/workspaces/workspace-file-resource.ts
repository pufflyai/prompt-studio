import type { ResourceRef } from "@pstdio/workbench";

export const workspaceFileResource = (resource: ResourceRef, path: string): ResourceRef => ({
  ...resource,
  metadata: {
    ...resource.metadata,
    workspaceView: "files",
    workspaceFilePath: path,
  },
});
