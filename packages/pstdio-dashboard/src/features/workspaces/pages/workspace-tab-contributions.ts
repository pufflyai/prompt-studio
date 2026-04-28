import type { WorkspacePageTab } from "./workspace-page-tab";

export type WorkspaceTabContribution<TComponent = unknown> = {
  value: WorkspacePageTab;
  label: string;
  order: number;
  extensionId?: string;
  component: TComponent;
};

export type ExtensionInstanceLike = {
  [key: string]: unknown;
  project_id?: unknown;
  extension_id?: unknown;
  enabled?: unknown;
};

const isDisabledExtensionInstance = (row: ExtensionInstanceLike, projectId: string | undefined, extensionId: string) =>
  row.project_id === projectId && row.extension_id === extensionId && row.enabled === false;

export const filterEnabledWorkspaceTabs = <TComponent>(
  tabs: WorkspaceTabContribution<TComponent>[],
  extensionInstances: ExtensionInstanceLike[],
  projectId: string | undefined,
) =>
  tabs.filter((tab) => {
    if (!tab.extensionId) return true;
    return !extensionInstances.some((row) => isDisabledExtensionInstance(row, projectId, tab.extensionId!));
  });

export const resolveSelectedWorkspaceTab = <TComponent>(
  requestedTab: WorkspacePageTab,
  tabs: WorkspaceTabContribution<TComponent>[],
) => {
  if (tabs.some((tab) => tab.value === requestedTab)) return requestedTab;
  return tabs[0]?.value ?? null;
};
