import { IconButton } from "@chakra-ui/react";
import { ResourceActionMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { resolvePageActivePlacement } from "../../core/registries/pages/page-active-placement";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { createWorkbenchLocationActions, useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { WorkbenchIcon } from "../shared/icon";
import { placementMenuActions } from "../shared/placement-menu-actions";
import { usePlacementTab } from "../shared/use-placement-tab";
import { useWorkbenchStore } from "../shared/use-workbench-store";
export const WorkbenchBreadcrumbActions = (props: { workbench: WorkbenchCore }) => {
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
  const contributed = placementMenuActions(workbench, snapshot);
  const subject = contributed.length ? placement?.resource : (items.at(-1)?.resource ?? placement?.resource);
  const resource = subject ? resolveResourcePreview(subject, changes) : undefined;
  const resolved = resource ? resolveActions(resource) : [];
  const resourceActions = contributed.length ? contributed : resolved;
  const [firstLocationAction, ...locationActions] = createWorkbenchLocationActions(workbench, resource);
  const actions = firstLocationAction
    ? [...resourceActions, { ...firstLocationAction, separatorBefore: resourceActions.length > 0 }, ...locationActions]
    : resourceActions;
  if (items.length === 0 || actions.length === 0) return null;
  const resourceLabel =
    (contributed.length ? snapshot.label : undefined) ?? resource?.label ?? resource?.id ?? resource?.type;
  const label = resource ? `Actions for ${resourceLabel}` : "Page actions";
  return (
    <ResourceActionMenu actions={actions} positioning={{ placement: "bottom-start" }}>
      <IconButton size="xs" variant="ghost" aria-label={label} data-workbench-breadcrumb-resource-actions="">
        <WorkbenchIcon name="ChevronDown" size={14} />
      </IconButton>
    </ResourceActionMenu>
  );
};
