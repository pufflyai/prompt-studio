import type { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import type { deleteProviderBackedWorkspace } from "../../workspaces/workspace-provider-lifecycle";
import type { fireExtensionEventAsync } from "../extension-event-runtime";
import type { EnabledExtensionSource } from "../project-extension-runtime-snapshot";

export type EnabledSource = EnabledExtensionSource;

export type CommandEnvironmentRuntimeDeps = {
  runWorkspaceProvisioning: typeof runWorkspaceProvisioning;
  deleteProviderBackedWorkspace?: typeof deleteProviderBackedWorkspace;
  fireExtensionEventAsync?: typeof fireExtensionEventAsync;
};

export const findEnabledSource = (enabledSources: EnabledSource[], extensionId: string) =>
  enabledSources.find(({ installedSource }) => installedSource.extension_id === extensionId);
