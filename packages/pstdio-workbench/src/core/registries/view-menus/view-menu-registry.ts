import { createDisposable, type Disposable } from "../../shared/disposable";
import type { WorkbenchPanelMenuDefinition, WorkbenchRegionSize } from "../layout/layout-types";
import type { WorkbenchViewRegistry } from "../views/view-registry";

export interface WorkbenchViewMenuContribution {
  id: string;
  ownerViewId: string;
  viewId: string;
  side: "left" | "right";
  priority?: number;
  mountStrategy?: "active" | "keep-mounted";
  hiddenByDefault?: boolean;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  config?: unknown;
}

export interface WorkbenchViewMenuRegistry {
  registerViewMenu(menu: WorkbenchViewMenuContribution): Disposable;
  getViewMenu(id: string): WorkbenchViewMenuContribution | undefined;
  listViewMenus(ownerViewId?: string): WorkbenchViewMenuContribution[];
  definitionsFor(ownerViewId: string, placementId: string): readonly WorkbenchPanelMenuDefinition[];
}

export const viewMenuPanelId = (placementId: string, menuId: string) =>
  `workbench.view-menu.${encodeURIComponent(placementId)}.${encodeURIComponent(menuId)}`;

const viewMenuConfig = (menu: WorkbenchViewMenuContribution) => {
  if (menu.config === undefined) return { viewContextId: menu.id };
  if (!menu.config || typeof menu.config !== "object" || Array.isArray(menu.config)) {
    return { viewContextId: menu.id, value: menu.config };
  }
  return { ...menu.config, viewContextId: menu.id };
};

export const createWorkbenchViewMenuRegistry = (input: { views: WorkbenchViewRegistry }): WorkbenchViewMenuRegistry => {
  const menus = new Map<string, WorkbenchViewMenuContribution>();

  return {
    registerViewMenu(menu) {
      if (menus.has(menu.id)) throw new Error(`View menu already registered: ${menu.id}`);
      if (!input.views.getView(menu.ownerViewId)) {
        throw new Error(`View menu owner is not registered: ${menu.ownerViewId}`);
      }
      if (!input.views.getView(menu.viewId)) throw new Error(`View menu View is not registered: ${menu.viewId}`);
      const record = { ...menu };
      menus.set(record.id, record);
      return createDisposable(() => {
        if (menus.get(record.id) === record) menus.delete(record.id);
      });
    },

    getViewMenu: (id) => menus.get(id),

    listViewMenus: (ownerViewId) =>
      [...menus.values()].filter((menu) => !ownerViewId || menu.ownerViewId === ownerViewId),

    definitionsFor(ownerViewId, placementId) {
      return [...menus.values()]
        .filter((menu) => menu.ownerViewId === ownerViewId)
        .map((menu) => {
          const view = input.views.getView(menu.viewId);
          if (!view) throw new Error(`View menu View is not registered: ${menu.viewId}`);
          return {
            id: viewMenuPanelId(placementId, menu.id),
            title: view.title,
            icon: view.icon,
            side: menu.side,
            rendererId: view.id,
            priority: menu.priority,
            mountStrategy: menu.mountStrategy,
            hiddenByDefault: menu.hiddenByDefault,
            regionSize: menu.regionSize,
            regionCollapsible: menu.regionCollapsible,
            headerBorderBottom: menu.headerBorderBottom,
            config: viewMenuConfig(menu),
          };
        });
    },
  };
};
