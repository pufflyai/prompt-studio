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

/** Context passed to row-level actions so hosts know which section or node triggered the action. */
export interface ListRowActionContext {
  sectionId?: string;
  nodeId?: string;
}

/** Menu item used by row overflow menus and context menus. */
export interface ListRowActionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode | ComponentType<{ size?: number | string }>;
  disabled?: boolean;
  readOnly?: boolean;
  /** Render a separator before this item when it follows a different action group. */
  separatorBefore?: boolean;
  /** Trailing content rendered after the label. Use for Kbd shortcuts, counts, or badges. */
  endContent?: ReactNode;
  onAction?: () => void;
}

/** Inline action rendered on a row, optionally backed by a menu. */
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

/** Data model for one reusable row, including labels, icons, menus, actions, and children. */
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

/** Props for the row surface used by lists, trees, menus, and dense navigation UIs. */
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
  /** Applies selected styling without owning selection state. */
  isSelected?: boolean;
  /** Controls child expansion styling and chevron state. */
  isExpanded?: boolean;
  /** Forces the expand affordance when children are lazy-loaded or externally controlled. */
  showExpandToggle?: boolean;
  variant?: ListRowVariant;
  tone?: ListRowTone;
  selectedBg?: ListRowRootProps["bg"];
  hoverBg?: ListRowRootProps["bg"];
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
