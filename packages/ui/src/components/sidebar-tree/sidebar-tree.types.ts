import type { IconProps } from "@chakra-ui/react";
import type { ComponentType, ReactNode } from "react";

export interface SidebarNavigationIntent {
  id?: string;
  payload?: unknown;
}

export interface SidebarActionContext {
  sectionId: string;
  nodeId?: string;
}

export interface SidebarActionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode | ComponentType<{ size?: number | string }>;
  disabled?: boolean;
  onAction?: () => void;
}

export interface SidebarAction {
  id: string;
  label: string;
  icon?: ReactNode;
  searchPlaceholder?: string;
  emptyMenuLabel?: string;
  menuItems?: SidebarActionMenuItem[];
  onAction?: (context: SidebarActionContext) => void;
}

export interface SidebarNode {
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
  disabled?: boolean;
  isNavigable?: boolean;
  /** URL for the node. When provided with a linkComponent, the row renders as an anchor for cmd+click support. */
  href?: string;
  navigationIntent?: SidebarNavigationIntent;
  contextMenuItems?: SidebarActionMenuItem[];
  actions?: SidebarAction[];
  children?: SidebarNode[];
}

export interface SidebarSection {
  id: string;
  label?: string;
  collapsible?: boolean;
  actions?: SidebarAction[];
  emptyState?: ReactNode;
  nodes: SidebarNode[];
}

export interface SidebarNavigateEvent {
  sectionId: string;
  nodeId: string;
  node: SidebarNode;
  intent?: SidebarNavigationIntent;
}

export interface SidebarLinkProps {
  to: string;
  children: ReactNode;
}

export type SidebarLinkComponent = ComponentType<SidebarLinkProps>;
