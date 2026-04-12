import type { ReactNode } from "react";
import type { SidebarLinkComponent, SidebarNavigateEvent, SidebarSection } from "../sidebar-tree/sidebar-tree.types";

export interface SidebarProps {
  storageKey: string;
  sections: SidebarSection[];
  activeNodeId?: string | string[] | null;
  header?: ReactNode;
  footer?: ReactNode;
  width?: string | number;
  emptyLabel?: string;
  defaultExpandedSections?: string[];
  linkComponent?: SidebarLinkComponent;
  onNavigate?: (event: SidebarNavigateEvent) => void;
  closable?: boolean;
  onOpenChange?: (open: boolean) => void;
}
