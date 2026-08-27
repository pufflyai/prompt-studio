import type { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import type { deleteProviderBackedWorkspace } from "../../workspaces/workspace-provider-lifecycle";
import type { cleanupWorkspaceWorktree } from "../../workspaces/worktree-cleanup";
import type { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";
import type { fireExtensionEventAsync } from "../extension-event-runtime";

export type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];

export type CommandEnvironmentRuntimeDeps = {
  setupWorkspaceWorktree: typeof setupWorkspaceWorktree;
  runWorkspaceProvisioning: typeof runWorkspaceProvisioning;
  deleteProviderBackedWorkspace?: typeof deleteProviderBackedWorkspace;
  cleanupWorkspaceWorktree?: typeof cleanupWorkspaceWorktree;
  fireExtensionEventAsync?: typeof fireExtensionEventAsync;
};

export const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string) =>
  enabledSources.find(({ installedSource }) => installedSource.extension_id === extensionId);
