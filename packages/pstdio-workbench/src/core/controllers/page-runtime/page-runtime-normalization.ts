import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { scopePageMainTabs } from "./page-main-tabs";
import { closeDepartingPagePreviews } from "./page-preview-lifetime";
import type { ConnectWorkbenchPageRuntimeInput } from "./page-runtime";
import { retireConflictingMainViewers } from "./retire-conflicting-main-viewers";
import { retainTrayPreviews } from "./tray-preview-retention";

export const normalizePageRuntimeState = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  operation: "navigate" | "select",
) => {
  const previous = input.registry.store.getState();
  const layout = input.layout.getLayout();
  const modeLayout = state.activeModeId ? input.loadModeLayout?.(state.projectId, state.activeModeId) : undefined;
  if (operation === "select")
    return scopePageMainTabs({
      state,
      previous,
      layout,
      pageLayout: layout,
      modeLayout,
      getWidget: input.layout.getWidget,
    });
  const pageLayout = input.loadPageLayout?.(state);
  const scoped = retainTrayPreviews(
    scopePageMainTabs({
      state: closeDepartingPagePreviews(state, previous, layout),
      previous,
      layout,
      pageLayout,
      modeLayout,
      getWidget: input.layout.getWidget,
    }),
    previous,
    pageLayout ?? layout,
    modeLayout,
  );
  if (!input.isResourceViewer) return scoped;
  return retireConflictingMainViewers({
    state: scoped,
    previous,
    sharedLayout:
      state.projectId === previous.projectId && state.activeModeId === previous.activeModeId ? layout : modeLayout,
    isResourceViewer: input.isResourceViewer,
    resourceKey: input.registry.resourceReferenceKey,
  });
};
