import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";

export interface ShellBreadcrumbItem {
  title: unknown;
  icon?: string;
  url?: string;
  onClick?: () => void;
}

export type ShellBreadcrumbChangeListener = () => void;

export interface ShellBreadcrumbState {
  items: ShellBreadcrumbItem[] | undefined;
}

export interface ShellBreadcrumbController {
  store: ShellStore<ShellBreadcrumbState>;
  setItems(items: ShellBreadcrumbItem[]): Disposable;
  clearItems(): void;
  getItems(): ShellBreadcrumbItem[] | undefined;
  onDidChange(listener: ShellBreadcrumbChangeListener): Disposable;
}

export const createShellBreadcrumbController = (): ShellBreadcrumbController => {
  const store = createShellStore<ShellBreadcrumbState>({
    name: "shell.breadcrumbs",
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
