import type { KanbanRendererAttributeDisplay } from "@pstdio/sdk/extensions";
import type { ComponentType, ReactNode } from "react";

/**
 * Core-owned contracts for kanban renderer contributions. @pstdio/ui's
 * KanbanRenderer props are structurally identical; the React layer bridges the
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

export type AttributeDisplayDescriptor = KanbanRendererAttributeDisplay;

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
  render?: (value: unknown, row: KanbanRendererRow) => ReactNode;
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

export interface KanbanRendererRow {
  id: string;
  title: string;
  /**
   * Optional navigation handle. When set, the renderer's default click handler
   * routes through the contribution's onRowActivate (which typically opens the
   * resource via the workbench).
   */
  resource?: unknown;
  attributes: Record<string, unknown>;
}

export interface KanbanRendererOrdering {
  attributeId: string | typeof MANUAL_ORDERING;
  direction: SortDirection;
}

export interface KanbanRendererSettings {
  viewMode: ViewMode;
  columnGrouping: string | typeof NO_GROUPING;
  rowGrouping: string | typeof NO_GROUPING;
  ordering: KanbanRendererOrdering;
  displayProperties: string[];
}

export type KanbanRendererFilterState = Record<string, string[]>;

export interface KanbanRendererSavedView {
  id: string;
  title: string;
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
  isDefault?: boolean;
}

export type KanbanRendererCreateFieldType =
  | "text"
  | "longtext"
  | "markdown"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "files";

export interface KanbanRendererCreateField {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  type: KanbanRendererCreateFieldType;
  required?: boolean;
  defaultValue?: unknown;
  options?: EnumOption[];
  /** `files` fields only. */
  multiple?: boolean;
  accept?: string;
}

/** Chrome copy is supplied by the caller so the dialog ships no strings of its own. */
export interface KanbanRendererCreateLabels {
  cancel: string;
  properties: string;
  submitError: string;
  removeFile: string;
}

export interface KanbanRendererCreateRowConfig {
  title: string;
  submitLabel: string;
  fields: KanbanRendererCreateField[];
  labels: KanbanRendererCreateLabels;
}

export interface KanbanRendererCreateSubmission {
  columnId: string;
  columnAttributeId?: string;
  /** Declared field values, excluding `files` fields — those arrive as `files`. */
  values: Record<string, unknown>;
  /** Every editable attribute the user set, keyed by attribute id. */
  attributeValues: Record<string, unknown>;
  files: File[];
}

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
  separatorBefore?: boolean;
}
