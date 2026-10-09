import { IconButton } from "@chakra-ui/react";
import { ResourceActionMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { createWorkbenchLocationActions, useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
export const WorkbenchBreadcrumbActions = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const items = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const resolveActions = useWorkbenchResourceActionResolver(workbench);
  const resource = items.at(-1)?.resource;
  const resourceActions = resource ? resolveActions(resource) : [];
  const [firstLocationAction, ...locationActions] = createWorkbenchLocationActions(workbench, resource);
  const actions = firstLocationAction
    ? [...resourceActions, { ...firstLocationAction, separatorBefore: resourceActions.length > 0 }, ...locationActions]
    : resourceActions;
  if (items.length === 0 || actions.length === 0) return null;
  const label = resource ? `Actions for ${resource.label ?? resource.id ?? resource.type}` : "Page actions";
  return (
    <ResourceActionMenu actions={actions} positioning={{ placement: "bottom-start" }}>
      <IconButton size="xs" variant="ghost" aria-label={label} data-workbench-breadcrumb-resource-actions="">
        <WorkbenchIcon name="ChevronDown" size={14} />
      </IconButton>
    </ResourceActionMenu>
  );
};
