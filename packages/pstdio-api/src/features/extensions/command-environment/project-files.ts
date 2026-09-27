import type { ExtensionsRouteDeps } from "../deps";
import { createWorkspaceFileMount, resolveWorkspaceFilesPath } from "./workspace-files";

export const createProjectFilesApi = (
  deps: ExtensionsRouteDeps,
  projectId: string,
  provisioningWorkspaceId?: string,
  signal?: AbortSignal,
) =>
  createWorkspaceFileMount(
    (access) => resolveWorkspaceFilesPath(deps, { projectId, provisioningWorkspaceId }, access),
    signal,
  );
