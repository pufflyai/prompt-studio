import type { ReactNode } from "react";

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
 * a live collection (e.g. a project-scoped resource) instead of a frozen
 * array, and the renderer subscribes to it the same way it subscribes to rows.
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

export const isEnumOptionsSource = (options: EnumOptions): options is EnumOptionsSource => !Array.isArray(options);

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
 * Reactive source for an entire attribute schema. Mirrors React's
 * useSyncExternalStore contract so consumers (e.g. the workbench's
 * data-renderer bridge) can subscribe and re-resolve when the schema changes
 * — letting a contribution add/remove/edit attributes at runtime without
 * re-registering.
 */
export interface AttributesSource {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AttributeDescriptor[];
}

export const isAttributesSource = (
  attributes: AttributeDescriptor[] | AttributesSource,
): attributes is AttributesSource => !Array.isArray(attributes);

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

export const DEFAULT_DATA_RENDERER_SETTINGS: DataRendererSettings = {
  viewMode: "board",
  columnGrouping: NO_GROUPING,
  rowGrouping: NO_GROUPING,
  ordering: { attributeId: MANUAL_ORDERING, direction: "asc" },
  displayProperties: [],
};

/**
 * Look up an attribute by id from a contribution-provided descriptor list.
 * Returns undefined for sentinels ("none", "manual") or unknown ids.
 */
export const findAttribute = (attributes: AttributeDescriptor[], id: string | undefined) => {
  if (!id || id === NO_GROUPING || id === MANUAL_ORDERING) return undefined;
  return attributes.find((attribute) => attribute.id === id);
};
