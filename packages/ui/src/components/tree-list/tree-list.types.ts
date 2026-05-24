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
export type TreeListNode = ListRowItem & {
  id: string;
  children?: TreeListNode[];
  hiddenByDefault?: boolean;
};

export interface TreeListSection {
  id: string;
  label?: string;
  collapsible?: boolean;
  actions?: TreeListAction[];
  emptyState?: ReactNode;
  nodes: TreeListNode[];
  hiddenByDefault?: boolean;
}

export interface TreeListNavigateEvent {
  sectionId: string;
  nodeId: string;
  node: TreeListNode;
  intent?: TreeListNavigationIntent;
}

export interface TreeListLinkProps {
  to: string;
  children: ReactNode;
}

export type TreeListLinkComponent = ComponentType<TreeListLinkProps>;
