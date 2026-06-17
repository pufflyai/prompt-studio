import type { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import type { ExtensionsRouteDeps } from "../deps";
import type { fireExtensionEventAsync } from "../extension-event-runtime";

export type EnabledSource = Awaited<
  ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];

export type CommandEnvironmentRuntimeDeps = {
  setupWorkspaceWorktree: typeof setupWorkspaceWorktree;
  fireExtensionEventAsync: typeof fireExtensionEventAsync;
};

export const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string) =>
  enabledSources.find(({ installedSource }) => installedSource.extension_id === extensionId);
