import type { ResourceRef, WorkbenchCore, WorkbenchTabSnapshot, WorkbenchWidgetPlacement } from "../../core";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { placementMenuActions } from "../shared/placement-menu-actions";
import { createWorkbenchResourceActions } from "./resource-actions";

export const createWorkbenchResourceMenu = (
  workbench: WorkbenchCore,
  subject: ResourceRef | undefined,
  snapshot: WorkbenchTabSnapshot,
  placement?: WorkbenchWidgetPlacement,
) => {
  const resource = subject
    ? resolveResourcePreview(subject, workbench.resources.preview.store.getState().changes)
    : undefined;
  return [
    ...(resource
      ? createWorkbenchResourceActions(workbench, resource, {
          context: {
            placement: placement?.placementIdentity,
            projectId: workbench.pages.store.getState().projectId,
          },
        })
      : []),
    ...placementMenuActions(workbench, snapshot, resource, placement),
  ];
};
