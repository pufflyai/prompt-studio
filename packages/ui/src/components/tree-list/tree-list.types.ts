import type { ComponentType, ReactNode } from "react";
import type {
  ListRowAction,
  ListRowActionContext,
  ListRowActionMenuItem,
  ListRowItem,
  ListRowNavigationIntent,
  ListRowVariant,
} from "../list-row/list-row.types";

export type TreeListNavigationIntent = ListRowNavigationIntent;
export type TreeListActionContext = ListRowActionContext;
export type TreeListActionMenuItem = ListRowActionMenuItem;
export type TreeListAction = ListRowAction;
export type TreeListNodeRowVariant = Extract<ListRowVariant, "empty-state">;

export interface TreeListInlineInput {
  ariaLabel: string;
  defaultValue?: string;
  placeholder?: string;
  onCommit(value: string): Promise<void> | void;
  onCancel?(): void;
}

/** Tree node data rendered by `TreeList`; extends the row API used by `ListRow`. */
export type TreeListNode = ListRowItem & {
  id: string;
  children?: TreeListNode[];
  /** Per-node visual row variant. Used for non-interactive placeholder rows. */
  rowVariant?: TreeListNodeRowVariant;
  inlineInput?: TreeListInlineInput;
  showContextMenuTrigger?: boolean;
  hiddenByDefault?: boolean;
  /** Opt in to the tree-customization (hide/show) menu. Items are non-hideable unless this is true. */
  canHide?: boolean;
  /** Opt out of reordering while keeping the node visible in its group. */
  canReorder?: boolean;
  /** Allow this node to be moved to another tree location. */
  canDrag?: boolean;
  /** Allow movable nodes to be dropped on this node. */
  canDrop?: boolean;
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
  /** Opt in to the tree-customization (hide/show) menu. Sections are non-hideable unless this is true. */
  canHide?: boolean;
  /** Opt out of reordering while keeping the section visible in its group. */
  canReorder?: boolean;
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
