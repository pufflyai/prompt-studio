import type { ReactNode } from "react";
import type { SidebarNavigateEvent, SidebarSection } from "../sidebar-tree/sidebar-tree.types";

export interface SidebarNextProps {
  storageKey: string;
  sections: SidebarSection[];
  activeNodeId?: string | null;
  header?: ReactNode;
  footer?: ReactNode;
  width?: string | number;
  emptyLabel?: string;
  onNavigate?: (event: SidebarNavigateEvent) => void;
  closable?: boolean;
  onOpenChange?: (open: boolean) => void;
}
