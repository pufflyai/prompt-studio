import { createDisposable, type Disposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";
import type { ShellCore } from "../../shell-core";

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

const findActivePlacement = (shell: ShellCore) => {
  const layout = shell.layout.getLayout();
  const activeId = layout.activeWidgetId;
  if (!activeId) return undefined;
  for (const area of Object.values(layout.areas)) {
    const placement = area.widgets.find((candidate) => candidate.widgetId === activeId);
    if (placement) return placement;
  }
  return undefined;
};

export const buildActiveWidgetBreadcrumb = (shell: ShellCore): ShellBreadcrumbItem[] => {
  const placement = findActivePlacement(shell);
  if (!placement) return [];
  const title = placement.resource?.label ?? placement.title ?? placement.contributionId;
  const kindIcon = placement.resource?.kind ? shell.resources.getKind(placement.resource.kind)?.icon : undefined;
  const icon = placement.resource?.icon ?? kindIcon;
  const onClick = placement.resource
    ? () => {
        void shell.resources.openResource(placement.resource!);
      }
    : () => {
        shell.layout.activateWidget(placement.widgetId);
      };
  return [{ title, icon, onClick }];
};
