import type { Disposable } from "../../shared/disposable";
import type { LayoutModel } from "../layout/layout-model";
import type {
  WidgetMountStrategy,
  WorkbenchFloatingPanelVisibility,
  WorkbenchPanelTab,
  WorkbenchRegion,
  WorkbenchWidgetRole,
} from "../layout/layout-types";
import type { WorkbenchViewMenuRegistry } from "../view-menus/view-menu-registry";
import type { WorkbenchViewRegistry } from "./view-registry";

export interface WorkbenchPlacementPresentation {
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  headerBorderBottom?: boolean;
  floatingPanels?: WorkbenchFloatingPanelVisibility;
  tab?: WorkbenchPanelTab;
  config?: unknown;
}

export interface RegisterWorkbenchViewPlacementInput extends WorkbenchPlacementPresentation {
  id: string;
  viewId: string;
  region: WorkbenchRegion;
  role: WorkbenchWidgetRole;
  singleton: boolean;
  closable: boolean;
}

export const registerWorkbenchViewPlacement = (
  layout: Pick<LayoutModel, "registerPanel">,
  views: WorkbenchViewRegistry,
  input: RegisterWorkbenchViewPlacementInput,
  viewMenus?: WorkbenchViewMenuRegistry,
): Disposable => {
  const view = views.getView(input.viewId);
  if (!view) throw new Error(`Workbench placement view is not registered: ${input.viewId}`);
  const { role: _role, viewId: _viewId, ...panel } = input;
  return layout.registerPanel({
    ...panel,
    title: view.title,
    icon: view.icon,
    rendererId: view.id,
    panelMenus: viewMenus?.definitionsFor(view.id, input.id),
  });
};

export const modePlacementContributionId = (placementId: string) =>
  `workbench.mode-placement.${encodeURIComponent(placementId)}`;

export const pagePlacementContributionId = (pageId: string, slotId: string) =>
  `workbench.page-placement.${encodeURIComponent(pageId)}.${encodeURIComponent(slotId)}`;
