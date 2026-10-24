import { IconButton } from "@chakra-ui/react";
import { ResourceActionMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { useBreadcrumbPlacement } from "../breadcrumb/use-breadcrumb-placement";
import { createWorkbenchLocationActions, useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { createWorkbenchResourceMenu } from "../menus/resource-menu";
import { WorkbenchIcon } from "../shared/icon";
import { placementMenuActions } from "../shared/placement-menu-actions";
import { usePlacementTab } from "../shared/use-placement-tab";
import { useWorkbenchStore } from "../shared/use-workbench-store";
export const WorkbenchBreadcrumbActions = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const items = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const { placement } = useBreadcrumbPlacement(workbench);
  const snapshot = usePlacementTab(placement, workbench);
  useWorkbenchResourceActionResolver(workbench);
  const subject = placement?.resource ?? items.at(-1)?.resource;
  const resource = subject ? resolveResourcePreview(subject, changes) : undefined;
  const resourceActions = createWorkbenchResourceMenu(workbench, resource, snapshot, placement);
  const actions = [
    ...resourceActions,
    ...placementMenuActions(workbench, { menu: items.at(-1)?.menu }, resource, placement),
    ...createWorkbenchLocationActions(workbench, resource).map((action) => ({
      ...action,
      group: { id: "location", label: "Location" },
    })),
  ];
  if (items.length === 0 || actions.length === 0) return null;
  const resourceLabel = snapshot.label ?? resource?.label ?? resource?.id ?? resource?.type;
  const label = resource ? `Actions for ${resourceLabel}` : "Page actions";
  return (
    <ResourceActionMenu actions={actions} positioning={{ placement: "bottom-start" }}>
      <IconButton size="xs" variant="ghost" aria-label={label} data-workbench-breadcrumb-resource-actions="">
        <WorkbenchIcon name="ChevronDown" size={14} />
      </IconButton>
    </ResourceActionMenu>
  );
};
