import type { ReactNode } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListSection } from "../tree-list/tree-list.types";

export interface SidebarProps {
  storageKey: string;
  sections: TreeListSection[];
  activeNodeId?: string | string[] | null;
  header?: ReactNode;
  footer?: ReactNode;
  /** Sidebar width. Splitter-managed sidebars should pass `100%`. */
  width?: string | number;
  emptyLabel?: string;
  defaultExpandedSections?: string[];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  closable?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}
