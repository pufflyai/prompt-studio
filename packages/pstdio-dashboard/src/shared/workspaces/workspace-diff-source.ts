import type { RuntimeCollections } from "@/lib/sync/collections";
import { createWorkspaceChangeSource } from "./workspace-change-source";

export const createWorkspaceDiffSource = (
  owner: RuntimeCollections,
  workspaceId: string,
  projectId: string,
  invalidate: () => void,
) => createWorkspaceChangeSource(owner, workspaceId, projectId, invalidate, "diff");
