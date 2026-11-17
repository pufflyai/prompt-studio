import type { WorkspaceCapabilities } from "pstdio-api-contracts/extension-kernel";

export const rootProviderId = "pstdio.root";
export const worktreeProviderId = "pstdio.worktree";
const gitExtensionProviderId = "pstdio.git-workspaces.workspace-type.git";

export const isBuiltInProviderId = (providerId: string) => providerId === rootProviderId;

// Existing workspace records and public clients keep their provider identity.
// Both IDs execute the installed extension through the ordinary provider runtime.
export const runtimeProviderId = (providerId: string) =>
  providerId === worktreeProviderId ? gitExtensionProviderId : providerId;
export const catalogProviderId = (providerId: string) =>
  providerId === gitExtensionProviderId ? worktreeProviderId : providerId;

export const remoteReadOnlyCapabilities = {
  files: "none",
  diff: false,
  merge: false,
  rebase: false,
  delete: true,
} satisfies WorkspaceCapabilities;
