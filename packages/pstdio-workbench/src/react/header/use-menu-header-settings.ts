import type { WorkbenchCore, WorkbenchWidgetPlacement } from "../../core";
import {
  type MenuHeaderSettings,
  readMenuHeaderSettings,
} from "../../core/controllers/panel-menus/menu-header-settings";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useMenuHeaderSettings = (workbench: WorkbenchCore, placement?: WorkbenchWidgetPlacement) => {
  "use no memo";
  useWorkbenchStore(workbench.preferences.store, (state) => state);
  const projectId = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const viewId = placement?.viewId ? (workbench.views.getView(placement.viewId)?.id ?? placement.viewId) : "";
  const settings = readMenuHeaderSettings(workbench, viewId);
  const configure = async (patch: Partial<MenuHeaderSettings>) => {
    if (!viewId || projectId !== workbench.pages.store.getState().projectId) return;
    await runUserAction(workbench, "Configure menu header", () =>
      workbench.commands.executeCommand("workbench.configureMenuHeader", { viewId, ...patch }),
    );
  };
  return { settings, configure };
};
