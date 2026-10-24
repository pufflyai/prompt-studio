import type { ResourceContextAction } from "@pstdio/ui";
import type {
  ResourceRef,
  WorkbenchCore,
  WorkbenchTabMenuRow,
  WorkbenchTabSnapshot,
  WorkbenchWidgetPlacement,
} from "../../core";
import type { WorkbenchCommandExecutionContext } from "../../core/registries/commands/command-registry";
import { WorkbenchIcon } from "./icon";
import { runPlacementAction } from "./run-placement-action";

const placementRowAction = (
  workbench: WorkbenchCore,
  row: WorkbenchTabMenuRow,
  resource: ResourceRef | undefined,
  context: WorkbenchCommandExecutionContext,
) => {
  const target = row.action?.kind === "navigation" ? row.action.target : row.action;
  return {
    key: row.id,
    label: row.label,
    commandId: target?.kind === "command" ? target.commandId : undefined,
    icon: row.icon ? <WorkbenchIcon name={row.icon} size={14} color={row.iconColor} /> : undefined,
    isDisabled: row.disabled,
    isSelected: row.selected,
    onClick: () => {
      if (row.action) runPlacementAction(workbench, row.action, undefined, resource, context);
    },
  };
};
export const placementMenuActions = (
  workbench: WorkbenchCore,
  snapshot: WorkbenchTabSnapshot,
  resource?: ResourceRef,
  placement?: WorkbenchWidgetPlacement,
) => {
  const context = { placement: placement?.placementIdentity, projectId: workbench.pages.store.getState().projectId };
  return (snapshot.menu ?? []).flatMap((section) => {
    const group = { id: `placement:${section.id}`, label: section.label };
    const actions: ResourceContextAction[] = section.rows.map((row) => ({
      ...placementRowAction(workbench, row, resource, context),
      key: `${section.id}:${row.id}`,
      group,
    }));
    return actions;
  });
};
