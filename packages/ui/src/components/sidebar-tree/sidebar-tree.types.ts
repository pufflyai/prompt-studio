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
  icon?: ReactNode;
  onAction?: () => void;
}

export interface SidebarAction {
  id: string;
  label: string;
  icon?: ReactNode;
  menuItems?: SidebarActionMenuItem[];
  onAction?: (context: SidebarActionContext) => void;
}

export interface SidebarNode {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  isNavigable?: boolean;
  /** URL for the node. When provided with a linkComponent, the row renders as an anchor for cmd+click support. */
  href?: string;
  navigationIntent?: SidebarNavigationIntent;
  actions?: SidebarAction[];
  children?: SidebarNode[];
}

export interface SidebarSection {
  id: string;
  label?: string;
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
