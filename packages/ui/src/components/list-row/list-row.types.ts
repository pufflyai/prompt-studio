import type { IconProps } from "@chakra-ui/react";
import type { ComponentType, ReactNode } from "react";

export interface ListRowNavigationIntent {
  id?: string;
  payload?: unknown;
}

export interface ListRowActionContext {
  sectionId?: string;
  nodeId?: string;
}

export interface ListRowActionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode | ComponentType<{ size?: number | string }>;
  disabled?: boolean;
  onAction?: () => void;
}

export interface ListRowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  searchPlaceholder?: string;
  emptyMenuLabel?: string;
  menuItems?: ListRowActionMenuItem[];
  onAction?: (context: ListRowActionContext) => void;
}

export interface ListRowItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconColor?: IconProps["color"];
  indicator?: {
    icon: ReactNode;
    color?: IconProps["color"];
    tooltip?: string | null;
  };
  /** Custom content rendered on the right, before any hover actions. Use for Kbd shortcuts, counts, or badges. */
  endContent?: ReactNode;
  /** Tooltip shown on hover. Can be a string or ReactNode (e.g. Kbd shortcut hint). */
  tooltip?: ReactNode;
  disabled?: boolean;
  /** Force chevron rendering even when children is empty (e.g. lazy-loaded folders). */
  isContainer?: boolean;
  isNavigable?: boolean;
  href?: string;
  navigationIntent?: ListRowNavigationIntent;
  onActivate?: () => void;
  contextMenuItems?: ListRowActionMenuItem[];
  actions?: ListRowAction[];
  children?: ListRowItem[];
}
