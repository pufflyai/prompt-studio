import type { ComponentType, ReactNode } from "react";
import type {
  ListRowAction,
  ListRowActionContext,
  ListRowActionMenuItem,
  ListRowItem,
  ListRowNavigationIntent,
} from "../list-row/list-row.types";

export type TreeListNavigationIntent = ListRowNavigationIntent;
export type TreeListActionContext = ListRowActionContext;
export type TreeListActionMenuItem = ListRowActionMenuItem;
export type TreeListAction = ListRowAction;

/** Tree node data rendered by `TreeList`; extends the row API used by `ListRow`. */
export type TreeListNode = ListRowItem & {
  id: string;
  children?: TreeListNode[];
  hiddenByDefault?: boolean;
  /** When false, the node cannot be hidden from a tree-customization menu (rendered as a disabled, checked row). */
  canHide?: boolean;
};

/** Top-level tree section with optional header, actions, empty state, and child nodes. */
export interface TreeListSection {
  id: string;
  label?: string;
  collapsible?: boolean;
  actions?: TreeListAction[];
  emptyState?: ReactNode;
  nodes: TreeListNode[];
  hiddenByDefault?: boolean;
}

/** Navigation payload emitted when a navigable tree node is activated. */
export interface TreeListNavigateEvent {
  sectionId: string;
  nodeId: string;
  node: TreeListNode;
  intent?: TreeListNavigationIntent;
}

/** Props passed to the host-provided tree link component. */
export interface TreeListLinkProps {
  to: string;
  children: ReactNode;
}

export type TreeListLinkComponent = ComponentType<TreeListLinkProps>;
