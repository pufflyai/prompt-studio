import { IconButton } from "@chakra-ui/react";
import { ResourceActionMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { resolvePageActivePlacement } from "../../core/registries/pages/page-active-placement";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { WorkbenchIcon } from "../shared/icon";
import { placementMenuActions } from "../shared/placement-menu-actions";
import { usePlacementTab } from "../shared/use-placement-tab";
import { useWorkbenchStore } from "../shared/use-workbench-store";
export const WorkbenchBreadcrumbResourceActions = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const items = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const changes = useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const page = useWorkbenchStore(workbench.pages.store, (state) =>
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );
  const placement = useWorkbenchStore(workbench.layout.store, (state) =>
    resolvePageActivePlacement(state.layout, page),
  );
  const snapshot = usePlacementTab(placement, workbench);
  const resolveActions = useWorkbenchResourceActionResolver(workbench);
  const resource = placement?.resource ? resolveResourcePreview(placement.resource, changes) : items.at(-1)?.resource;
  const contributed = placementMenuActions(workbench, snapshot);
  const resolved = resource ? resolveActions(resource) : [];
  const actions = contributed.length ? contributed : resolved;
  if (!resource || actions.length === 0) return null;
  const label = snapshot.label ?? resource.label ?? resource.id ?? resource.type;
  return (
    <ResourceActionMenu actions={actions} positioning={{ placement: "bottom-start" }}>
      <IconButton
        size="xs"
        variant="ghost"
        aria-label={`Actions for ${label}`}
        data-workbench-breadcrumb-resource-actions=""
      >
        <WorkbenchIcon name="ChevronDown" size={14} />
      </IconButton>
    </ResourceActionMenu>
  );
};
