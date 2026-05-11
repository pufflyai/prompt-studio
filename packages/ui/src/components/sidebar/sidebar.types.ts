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
  /** Allow split layouts to resize the sidebar. Defaults to `true`. */
  resizable?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * When enabled, the scroll content is virtualized — only nodes near the viewport
   * are mounted. Use for sidebars that may contain hundreds of entries. Requires
   * sections with flat nodes (no expandable children).
   */
  virtualize?: boolean;
}
