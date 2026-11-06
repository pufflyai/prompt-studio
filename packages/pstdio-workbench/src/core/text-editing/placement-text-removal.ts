import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelInstance } from "../registries/layout/layout-model";
import type { WorkbenchCore } from "../workbench-core-types";

/** Resource deletion cannot destroy a guest before its public close barrier settles. */
export const retainPlacementTextOnRemoval = (input: {
  workbench: WorkbenchCore;
  placement: WorkbenchPanelInstance;
  projectId: string;
  current: () => boolean;
  close: () => Promise<void>;
}) => {
  const { workbench, placement, projectId } = input;
  const identity = placement.placementIdentity;
  const resource = placement.resource;
  if (!identity || !resource) return () => {};
  const invocation = workbench.viewers.captureContext(identity);
  const report = workbench.notifications.captureActionError("Close removed text editor", placement.instanceId);
  let preparing: Promise<void> | undefined;
  const subscription = workbench.resources.onWillRemove((removed) => {
    if (!input.current() || resourceKey(resource) !== resourceKey(removed)) return [];
    if (!preparing)
      preparing = Promise.resolve()
        .then(input.close)
        .then(() => {
          // close() releases this owner's removal subscription. Reconcile only its captured binding.
          if (workbench.pages.store.getState().projectId === projectId && invocation.isViewerCurrent?.() !== false)
            workbench.resources.removed(removed);
        })
        .catch(report)
        .finally(() => {
          preparing = undefined;
        });
    return [identity];
  });
  return () => subscription.dispose();
};
