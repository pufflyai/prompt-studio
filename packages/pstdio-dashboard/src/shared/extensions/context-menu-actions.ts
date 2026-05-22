import type { ResourceContextAction, TreeListActionMenuItem } from "@pstdio/ui";
import type { ComponentType } from "react";
import { renderHeaderActionIcon } from "./components/action-icons";
import { getHeaderActionState, type HeaderActionItem } from "./components/header-actions";

export const headerActionsToResourceContextActions = (input: {
  actions?: HeaderActionItem[];
  pendingActionKeys?: string[];
}): ResourceContextAction[] => {
  const { actions = [], pendingActionKeys = [] } = input;

  return actions.map((action) => {
    const state = getHeaderActionState(action, pendingActionKeys);
    return {
      key: action.key,
      label: action.label,
      icon: renderHeaderActionIcon(action.icon, 16) ?? undefined,
      isDisabled: state.isDisabled,
      onClick: action.onClick,
    };
  });
};

const resolveTreeListActionIcon = (icon: unknown): ComponentType<{ size?: number | string }> | undefined => {
  if (!icon) return undefined;
  if (typeof icon === "function") return icon as ComponentType<{ size?: number | string }>;
  if (typeof icon === "object" && "$$typeof" in icon) {
    return icon as ComponentType<{ size?: number | string }>;
  }
  if (typeof icon === "object" && "type" in icon && typeof icon.type === "function") {
    return icon.type as ComponentType<{ size?: number | string }>;
  }

  return undefined;
};

export const toSidebarContextMenuItems = (actions: ResourceContextAction[]): TreeListActionMenuItem[] =>
  actions.map(
    (action) =>
      ({
        id: action.key,
        label: action.label,
        icon: resolveTreeListActionIcon(action.icon),
        disabled: action.isDisabled,
        onAction: action.onClick,
      }) as TreeListActionMenuItem,
  );
