import type { ResourceRef, WorkbenchCore, WorkbenchTabSnapshot } from "../../core";
import { resolveResourcePreview } from "../../core/registries/resources/resource-preview";
import { placementMenuActions } from "../shared/placement-menu-actions";
import { createWorkbenchResourceActions } from "./resource-actions";

export const createWorkbenchResourceMenu = (
  workbench: WorkbenchCore,
  subject: ResourceRef | undefined,
  snapshot: WorkbenchTabSnapshot,
) => {
  const resource = subject
    ? resolveResourcePreview(subject, workbench.resources.preview.store.getState().changes)
    : undefined;
  return [
    ...(resource ? createWorkbenchResourceActions(workbench, resource) : []),
    ...placementMenuActions(workbench, snapshot, resource),
  ];
};
