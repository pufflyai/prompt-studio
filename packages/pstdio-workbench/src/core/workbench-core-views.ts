import type { LayoutModel } from "./registries/layout/layout-model";
import { createWorkbenchOverlayRegistry } from "./registries/overlays/overlay-registry";
import { createStatusBarRegistry } from "./registries/status-bar/status-bar-registry";
import { createWorkbenchViewMenuRegistry } from "./registries/view-menus/view-menu-registry";
import { createWorkbenchViewBodyRegistration } from "./registries/views/view-body-registration";
import { createViewRegistry } from "./registries/views/view-registry";
import type { createWorkbenchInput, WorkbenchRenderers } from "./workbench-core-types";

export const createCoreViews = (input: createWorkbenchInput, renderers: WorkbenchRenderers, layout: LayoutModel) => {
  const views = createViewRegistry({ registerBody: createWorkbenchViewBodyRegistration(renderers) });
  const viewMenus = createWorkbenchViewMenuRegistry({ views });
  return {
    views,
    viewMenus,
    overlays: createWorkbenchOverlayRegistry({ layout, views, viewMenus }),
    statusBar: createStatusBarRegistry({
      hasView: (viewId) => Boolean(views.getView(viewId)),
      persistence: input.statusBarPersistence,
    }),
  };
};
