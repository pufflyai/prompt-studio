import {
  isWorkbenchViewHierarchyNode,
  type ResourceRef,
  type ResourceRegistry,
} from "../../registries/resources/resource-registry";
import type { WorkbenchViewRegistry } from "../../registries/views/view-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface WorkbenchBreadcrumbItem {
  title: unknown;
  icon?: string;
  indicator?: "session-status";
  url?: string;
  onClick?: () => void;
  resource?: ResourceRef;
}

export type WorkbenchBreadcrumbChangeListener = () => void;

export interface WorkbenchBreadcrumbState {
  items: WorkbenchBreadcrumbItem[] | undefined;
}

export interface WorkbenchBreadcrumbController {
  store: WorkbenchStore<WorkbenchBreadcrumbState>;
  setItems(items: WorkbenchBreadcrumbItem[]): Disposable;
  clearItems(): void;
  getItems(): WorkbenchBreadcrumbItem[] | undefined;
  onDidChange(listener: WorkbenchBreadcrumbChangeListener): Disposable;
}

export const createResourceBreadcrumbItems = (
  resources: ResourceRegistry,
  resource: ResourceRef | undefined,
  views?: WorkbenchViewRegistry,
): WorkbenchBreadcrumbItem[] => {
  const path = resources.walkHierarchy(resource);

  return path.map((entry, index) => {
    if (isWorkbenchViewHierarchyNode(entry)) {
      const view = views?.getView(entry.viewId);
      return {
        title: entry.label ?? view?.title ?? entry.viewId,
        icon: entry.icon ?? view?.icon,
        ...(index < path.length - 1 && views
          ? { onClick: () => void views.openView(entry.viewId, { strategy: { kind: "replace-active" } }) }
          : {}),
      };
    }
    return {
      title: entry.label ?? entry.id ?? resources.getKind(entry.kind)?.label ?? entry.kind,
      icon: entry.icon ?? resources.getKind(entry.kind)?.icon,
      resource: entry,
      ...(index < path.length - 1
        ? { onClick: () => void resources.openResource(entry, { replaceActive: true }) }
        : {}),
    };
  });
};

export const createWorkbenchBreadcrumbController = (): WorkbenchBreadcrumbController => {
  const store = createWorkbenchStore<WorkbenchBreadcrumbState>({
    name: "workbench.breadcrumbs",
    initialState: { items: undefined },
  });

  return {
    store,

    setItems(items) {
      store.setState({ items }, false, "setBreadcrumbItems");
      return createDisposable(() => {
        if (store.getState().items === items) {
          store.setState({ items: undefined }, false, "clearBreadcrumbItems");
        }
      });
    },

    clearItems() {
      if (store.getState().items === undefined) return;
      store.setState({ items: undefined }, false, "clearBreadcrumbItems");
    },

    getItems() {
      return store.getState().items;
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribeSelector(
        (state) => state.items,
        () => listener(),
      );
      return createDisposable(unsubscribe);
    },
  };
};
