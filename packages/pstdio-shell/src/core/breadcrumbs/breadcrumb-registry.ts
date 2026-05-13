import { createDisposable, type Disposable } from "../disposable";
import type { ShellCore } from "../shell-core";

export interface ShellBreadcrumbItem {
  title: unknown;
  icon?: string;
  url?: string;
  onClick?: () => void;
}

export type ShellBreadcrumbChangeListener = () => void;

export interface ShellBreadcrumbController {
  setItems(items: ShellBreadcrumbItem[]): Disposable;
  clearItems(): void;
  getItems(): ShellBreadcrumbItem[] | undefined;
  onDidChange(listener: ShellBreadcrumbChangeListener): Disposable;
}

export const createShellBreadcrumbController = (): ShellBreadcrumbController => {
  let current: ShellBreadcrumbItem[] | undefined;
  const listeners = new Set<ShellBreadcrumbChangeListener>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    setItems(items) {
      current = items;
      notify();
      return createDisposable(() => {
        if (current === items) {
          current = undefined;
          notify();
        }
      });
    },

    clearItems() {
      if (current === undefined) return;
      current = undefined;
      notify();
    },

    getItems() {
      return current;
    },

    onDidChange(listener) {
      listeners.add(listener);
      return createDisposable(() => {
        listeners.delete(listener);
      });
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
