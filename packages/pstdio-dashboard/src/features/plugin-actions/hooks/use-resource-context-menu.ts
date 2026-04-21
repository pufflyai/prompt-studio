import type { SidebarActionMenuItem } from "@pstdio/ui";
import type { ComponentType } from "react";
import type { ActionDescriptor } from "../api";
import { buildHeaderActionGroups, type HeaderActionItem } from "../components/header-action-groups";
import { getHeaderActionState } from "../components/plugin-header-actions";

interface BuildResourceContextMenuActionsInput {
  pluginActions?: ActionDescriptor[];
  defaultOverflowActions?: HeaderActionItem[];
  pendingActionKeys?: string[];
  onPluginAction: (actionKey: string) => void;
}

export const buildResourceContextMenuActions = (input: BuildResourceContextMenuActionsInput): HeaderActionItem[] => {
  const { pluginActions, defaultOverflowActions = [], pendingActionKeys = [], onPluginAction } = input;
  const groups = buildHeaderActionGroups({ pluginActions, defaultOverflowActions, onPluginAction });

  return [...groups.primary, ...groups.secondary, ...groups.overflow].map((action) => {
    const state = getHeaderActionState(action, pendingActionKeys);
    return { ...action, isDisabled: state.isDisabled };
  });
};

const resolveSidebarActionIcon = (icon: unknown): ComponentType<{ size?: number | string }> | undefined => {
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

export const toSidebarContextMenuItems = (actions: HeaderActionItem[]): SidebarActionMenuItem[] =>
  actions.map(
    (action) =>
      ({
        id: action.key,
        label: action.label,
        icon: resolveSidebarActionIcon(action.icon),
        disabled: action.isDisabled,
        onAction: action.onClick,
      }) as SidebarActionMenuItem,
  );
