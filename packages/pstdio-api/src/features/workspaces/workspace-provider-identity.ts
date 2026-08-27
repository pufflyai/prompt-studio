import type { WorkspaceCapabilities } from "pstdio-api-contracts/extension-kernel";

export const rootProviderId = "pstdio.root";
export const worktreeProviderId = "pstdio.worktree";

export const isBuiltInProviderId = (providerId: string) =>
  providerId === rootProviderId || providerId === worktreeProviderId;

export const remoteReadOnlyCapabilities = {
  files: "none",
  diff: false,
  merge: false,
  rebase: false,
  archive: true,
  delete: true,
} satisfies WorkspaceCapabilities;
