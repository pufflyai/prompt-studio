import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { usePendingExtensionSourceChanges } from "@/shared/extensions/use-extension-mutation";
import { useProjectExtensions } from "@/shared/extensions/use-project-extensions";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";
import { ExtensionsPanelHeader } from "./extensions-panel-header";
import { useExtensionPanelActions } from "./use-extension-panel-actions";

export const ExtensionsPageHeader = ({ input }: { input: WorkbenchPanelRenderInput }) => {
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const inventory = useProjectExtensions(projectId);
  const changing = usePendingExtensionSourceChanges(projectId);
  const actions = useExtensionPanelActions(projectId, inventory.data?.upgradeConcurrency);
  const upgradable =
    inventory.data?.extensions.filter((extension) => extension.canUpgrade && !changing.has(extension.id)) ?? [];
  return (
    <ExtensionsPanelHeader
      searchId={`extension-search-${input.instance.instanceId}`}
      filters={actions.filters}
      onFiltersChange={actions.setFilters}
      upgrade={
        (upgradable.length > 0 || actions.batch) && (
          <ExtensionUpgradeProgress
            batch={actions.batch}
            onUpgrade={() => void actions.handleUpgradeAll(upgradable)}
            onDismiss={actions.dismissBatch}
            canUpgrade={upgradable.length > 0}
          />
        )
      }
    />
  );
};
