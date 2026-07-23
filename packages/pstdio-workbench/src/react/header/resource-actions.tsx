import { IconButton } from "@chakra-ui/react";
import { ResourceActionMenu } from "@pstdio/ui";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchResourceActionResolver } from "../menus/resource-actions";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const WorkbenchBreadcrumbResourceActions = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const items = useWorkbenchStore(workbench.breadcrumbs.store, (state) => state.items) ?? [];
  const resolveActions = useWorkbenchResourceActionResolver(workbench);
  const resource = items.at(-1)?.resource;
  const actions = resource ? resolveActions(resource) : [];

  if (!resource || actions.length === 0) return null;

  const label = resource.label ?? resource.id ?? resource.kind;

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
