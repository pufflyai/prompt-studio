import type { ComponentType, ReactNode } from "react";

/**
 * Core-owned contracts for data renderer contributions. @pstdio/ui's
 * DataRenderer props are structurally identical; the React layer bridges the
 * two, so drift surfaces as a compile error there instead of coupling core's
 * API shape to UI package ownership.
 */

export type ViewMode = "board" | "list";

export type SortDirection = "asc" | "desc";

export const NO_GROUPING = "none";
export const MANUAL_ORDERING = "manual";

export interface EnumOption {
  value: string;
  label: string;
  color?: string;
  icon?: string | null;
}

/**
 * Reactive options source for enum / enum-multi attributes. Mirrors React's
 * useSyncExternalStore contract so a contribution can hand its options off as
 * a live collection instead of a frozen array.
 */
export interface EnumOptionsSource {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => EnumOption[];
}

export type EnumOptions = EnumOption[] | EnumOptionsSource;

export type AttributeType =
  | { kind: "enum"; options: EnumOptions }
  | { kind: "enum-multi"; options: EnumOptions }
  | { kind: "string" }
  | { kind: "date" }
  | { kind: "number" }
  | { kind: "user" };

export type AttributeKind = AttributeType["kind"];

export type AttributeDisplayDescriptor = { kind: "workspace-badge"; itemsAttributeId: string };

export interface AttributeDescriptor {
  id: string;
  label: string;
  type: AttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
  display?: AttributeDisplayDescriptor;
  render?: (value: unknown, row: DataRendererRow) => ReactNode;
  compare?: (a: unknown, b: unknown) => number;
}

/**
 * Reactive source for an entire attribute schema. Lets a contribution
 * add/remove/edit attributes at runtime without re-registering.
 */
export interface AttributesSource {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AttributeDescriptor[];
}

export interface DataRendererRow {
  id: string;
  title: string;
  /**
   * Optional navigation handle. When set, the renderer's default click handler
   * routes through the contribution's onRowClick (which typically opens the
   * resource via the workbench).
   */
  resource?: unknown;
  attributes: Record<string, unknown>;
}

export interface DataRendererOrdering {
  attributeId: string | typeof MANUAL_ORDERING;
  direction: SortDirection;
}

export interface DataRendererSettings {
  viewMode: ViewMode;
  columnGrouping: string | typeof NO_GROUPING;
  rowGrouping: string | typeof NO_GROUPING;
  ordering: DataRendererOrdering;
  displayProperties: string[];
}

export type DataRendererFilterState = Record<string, string[]>;

export interface BoardColumnAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}

/** Board-column behavior and menu configuration for a resolved column group. */
export interface BoardColumnConfig {
  /** Color palette token used for the column header and group badges. */
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: BoardColumnAction[];
}

/** Row-level context menu action surfaced by the renderer. */
export interface ResourceContextAction {
  key: string;
  label: string;
  onClick: () => Promise<void> | void;
  isDisabled?: boolean;
  icon?: ReactNode;
  endContent?: ReactNode;
}
