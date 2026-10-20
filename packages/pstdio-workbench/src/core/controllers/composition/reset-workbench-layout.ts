import { type WorkbenchLayout, workbenchPanelRegions } from "../../registries/layout/layout-types";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { createWorkbenchEvent } from "../../shared/workbench-event";
import type { WorkbenchCore, WorkbenchPageChoicesTarget } from "../../workbench-core-types";

// Reset presentation in place. The placement registries and live views still own
// every resource, including tabs moved from their declared destinations.
const resetPanelLayout = (core: WorkbenchCore, defaults: WorkbenchLayout) => {
  const layout = core.layout.getLayout();
  const regions = { ...layout.regions };
  for (const id of workbenchPanelRegions) {
    const region = layout.regions[id];
    const policy = core.shell.getPanelPolicy(id);
    regions[id] = {
      ...region,
      size: defaults.regions[id].size,
      headerVisible: undefined,
      presentation: defaults.regions[id].presentation,
      visible: policy.provided && (policy.canOpen || region.visible) && defaults.regions[id].visible,
    };
  }
  core.layout.restoreLayout({ ...layout, regions });
};

export const createLayoutResetController = (resolve: () => WorkbenchCore, defaults: WorkbenchLayout) => {
  const panels = createWorkbenchEvent<void>("panel layout reset");
  const choices = createWorkbenchEvent<WorkbenchPageChoicesTarget>("page choices reset");
  return {
    resetPanelLayout() {
      batchWorkbenchChanges(() => {
        resetPanelLayout(resolve(), defaults);
        // Observers take the restored snapshot before batched layout notifications
        // so a reset never becomes a manual related-resource choice.
        panels.notify();
      });
    },
    onDidResetPanelLayout: panels.subscribe,
    resetPageChoices(target?: WorkbenchPageChoicesTarget) {
      if (target) {
        choices.notify(target);
        return;
      }
      const { projectId, activePageId, location } = resolve().pages.store.getState();
      if (projectId && activePageId && location?.resource)
        choices.notify({ projectId, pageId: activePageId, resource: location.resource });
    },
    onDidResetPageChoices: choices.subscribe,
  };
};
