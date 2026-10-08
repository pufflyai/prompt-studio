import { createStatusBarRegistry } from "./registries/status-bar/status-bar-registry";
import { createWorkbenchViewMenuRegistry } from "./registries/view-menus/view-menu-registry";
import { createWorkbenchViewBodyRegistration } from "./registries/views/view-body-registration";
import { createViewRegistry } from "./registries/views/view-registry";
import type { createWorkbenchInput, WorkbenchRenderers } from "./workbench-core-types";

export const createCoreViews = (input: createWorkbenchInput, renderers: WorkbenchRenderers) => {
  const views = createViewRegistry({ registerBody: createWorkbenchViewBodyRegistration(renderers) });
  return {
    views,
    viewMenus: createWorkbenchViewMenuRegistry({ views }),
    statusBar: createStatusBarRegistry({
      hasView: (viewId) => Boolean(views.getView(viewId)),
      persistence: input.statusBarPersistence,
    }),
  };
};
