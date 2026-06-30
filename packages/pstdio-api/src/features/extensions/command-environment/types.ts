import type { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import type { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";

export type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];

export type CommandEnvironmentRuntimeDeps = {
  setupWorkspaceWorktree: typeof setupWorkspaceWorktree;
  runWorkspaceProvisioning: typeof runWorkspaceProvisioning;
};

export const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string) =>
  enabledSources.find(({ installedSource }) => installedSource.extension_id === extensionId);
