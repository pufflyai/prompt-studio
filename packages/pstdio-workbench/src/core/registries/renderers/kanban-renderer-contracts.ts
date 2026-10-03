import type { KanbanRendererAttributeDisplay, ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";

/**
 * Core-owned contracts for kanban renderer contributions. @pstdio/ui's
 * KanbanRenderer props are structurally identical; the React layer bridges the
 * two, so drift surfaces as a compile error there instead of coupling core's
 * API shape to UI package ownership.
 */

export type ViewMode = "board" | "list";

export const NO_GROUPING = "none";

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
  | { kind: "boolean"; legacyValues?: Record<string, boolean> }
  | { kind: "string" }
  | { kind: "date" }
  | { kind: "number" }
  | { kind: "user" };

export type AttributeKind = AttributeType["kind"];

export type AttributeDisplayDescriptor = KanbanRendererAttributeDisplay;

export interface AttributeDescriptor<TNode = unknown> {
  id: string;
  label: string;
  type: AttributeType;
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  displayable?: boolean;
  editable?: boolean;
  display?: AttributeDisplayDescriptor;
  render?: (value: unknown, row: KanbanRendererRow) => TNode;
  compare?: (a: unknown, b: unknown) => number;
}

/**
 * Reactive source for an entire attribute schema. Lets a contribution
 * add/remove/edit attributes at runtime without re-registering.
 */
export interface AttributesSource<TNode = unknown> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AttributeDescriptor<TNode>[];
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

/** Board display settings. Order lives in the view's sorts. */
export interface KanbanRendererSettings {
  viewMode: ViewMode;
  columnGrouping: string | typeof NO_GROUPING;
  rowGrouping: string | typeof NO_GROUPING;
  displayProperties: string[];
}

/** A view stores display settings, one filter, and its sorts. Search is screen state and never saved. */
export interface CollectionSavedView<TSettings> {
  id: string;
  title: string;
  settings: TSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
}

export type KanbanRendererSavedView = CollectionSavedView<KanbanRendererSettings>;

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

export interface BoardColumnAction<TIcon = unknown> {
  id: string;
  label: string;
  icon: TIcon;
}

/** Board-column behavior and menu configuration for a resolved column group. */
export interface BoardColumnConfig<TIcon = unknown> {
  /** Color palette token used for the column header and group badges. */
  color?: string;
  canDragIn?: boolean;
  canDragOut?: boolean;
  canCreate?: boolean;
  actions?: BoardColumnAction<TIcon>[];
}

/** Row-level context menu action surfaced by the renderer. */
export interface ResourceContextAction<TNode = unknown> {
  key: string;
  label: string;
  onClick: () => Promise<void> | void;
  isDisabled?: boolean;
  icon?: TNode;
  endContent?: TNode;
  separatorBefore?: boolean;
}

export interface CollectionViewsSource<TSettings> {
  views: (CollectionSavedView<TSettings> & { builtIn: boolean })[];
  defaultViewId: string;
  onCreateView: (input: {
    title: string;
    settings: TSettings;
    filter: ViewFilterGroup;
    sorts: ViewSort[];
    copyFrom?: string;
  }) => Promise<CollectionSavedView<TSettings>>;
  onUpdateView: (
    id: string,
    input: { title?: string; settings?: TSettings; filter?: ViewFilterGroup; sorts?: ViewSort[] },
  ) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  onSetDefaultView: (id: string | null) => Promise<void>;
}

export interface CollectionViewsProvider<TSettings> {
  getSnapshot: () => CollectionViewsSource<TSettings> | undefined;
  subscribe: (listener: () => void) => () => void;
}

export type KanbanRendererViewsSource = CollectionViewsSource<KanbanRendererSettings>;
export type KanbanRendererViewsProvider = CollectionViewsProvider<KanbanRendererSettings>;
