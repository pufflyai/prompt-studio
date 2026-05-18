import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

export interface WorkbenchBreadcrumbItem {
  title: unknown;
  icon?: string;
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
