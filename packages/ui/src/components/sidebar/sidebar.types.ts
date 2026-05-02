import type { ReactNode } from "react";
import type { TreeListLinkComponent, TreeListNavigateEvent, TreeListSection } from "../tree-list/tree-list.types";

export interface SidebarProps {
  storageKey: string;
  sections: TreeListSection[];
  activeNodeId?: string | string[] | null;
  header?: ReactNode;
  footer?: ReactNode;
  /** Initial width when resizable. Set explicitly to override the persisted width. */
  width?: string | number;
  emptyLabel?: string;
  defaultExpandedSections?: string[];
  linkComponent?: TreeListLinkComponent;
  onNavigate?: (event: TreeListNavigateEvent) => void;
  closable?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Allow the user to drag the right edge to resize. Defaults to `true`. */
  resizable?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}
