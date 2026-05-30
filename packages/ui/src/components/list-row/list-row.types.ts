import type { chakra, IconProps } from "@chakra-ui/react";
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";

export interface ListRowNavigationIntent {
  id?: string;
  payload?: unknown;
}

export interface ListRowActionContext {
  sectionId?: string;
  nodeId?: string;
}

export interface ListRowActionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode | ComponentType<{ size?: number | string }>;
  disabled?: boolean;
  readOnly?: boolean;
  /** Trailing content rendered after the label. Use for Kbd shortcuts, counts, or badges. */
  endContent?: ReactNode;
  onAction?: () => void;
}

export interface ListRowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Tooltip shown when the action button is hovered or focused. Can include label + Kbd hint. */
  tooltip?: ReactNode;
  searchPlaceholder?: string;
  emptyMenuLabel?: string;
  menuItems?: ListRowActionMenuItem[];
  onAction?: (context: ListRowActionContext) => void;
}

export type ListRowVariant = "default" | "compact" | "tree";
export type ListRowTone = "default" | "danger";
export type ListRowMenuPlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "right"
  | "right-start"
  | "right-end"
  | "left"
  | "left-start"
  | "left-end";

export interface ListRowItem {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconColor?: IconProps["color"];
  indicator?: {
    icon: ReactNode;
    color?: IconProps["color"];
    tooltip?: string | null;
  };
  /** Custom content rendered on the right, before any hover actions. Use for Kbd shortcuts, counts, or badges. */
  endContent?: ReactNode;
  /** Tooltip shown on hover. Can be a string or ReactNode (e.g. Kbd shortcut hint). */
  tooltip?: ReactNode;
  disabled?: boolean;
  /** Force chevron rendering even when children is empty (e.g. lazy-loaded folders). */
  isContainer?: boolean;
  isNavigable?: boolean;
  href?: string;
  navigationIntent?: ListRowNavigationIntent;
  onActivate?: () => void;
  /** Left-click menu opened from the row surface. */
  menuItems?: ListRowActionMenuItem[];
  menuPlacement?: ListRowMenuPlacement;
  contextMenuItems?: ListRowActionMenuItem[];
  actions?: ListRowAction[];
  children?: ListRowItem[];
}

type ListRowRootProps = ComponentPropsWithoutRef<typeof chakra.div>;

export interface ListRowProps
  extends ListRowItem,
    Omit<
      ListRowRootProps,
      | "as"
      | "asChild"
      | "children"
      | "draggable"
      | "onClick"
      | "onDragEnd"
      | "onDragOver"
      | "onDragStart"
      | "onDrop"
      | "onPointerMove"
      | keyof ListRowItem
    > {
  depth?: number;
  isSelected?: boolean;
  isExpanded?: boolean;
  showExpandToggle?: boolean;
  variant?: ListRowVariant;
  tone?: ListRowTone;
  /** Wrap content into a single child element. Used for `<Menu.Item asChild><ListRow asChild>…</ListRow></Menu.Item>` and link components. */
  asChild?: boolean;
  onToggleExpand?: () => void;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
  draggable?: boolean;
  onDragStart?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  onDragEnd?: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLElement>) => void;
}

export interface RowContentProps {
  item: ListRowItem;
  isExpanded: boolean;
  showChevron: boolean;
  isDisabled: boolean;
  variant: ListRowVariant;
  tone: ListRowTone;
}
