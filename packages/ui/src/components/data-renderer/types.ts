export type ViewMode = "board" | "list";

export type GroupingField = "status" | "assignee" | "none" | `tag:${string}`;

export type OrderingField = "manual" | "updated" | "title" | "ticketId" | `tag:${string}`;

export type SortDirection = "asc" | "desc";

export type DisplayProperty = "id" | "status" | "assignee" | "updated" | `tag:${string}`;

export type FilterCategory = "status" | "assignee" | `tag:${string}`;

export interface DataRendererOrdering {
  field: OrderingField;
  direction: SortDirection;
}

export interface DataRendererSettings {
  viewMode: ViewMode;
  columnGrouping: GroupingField;
  rowGrouping: GroupingField;
  ordering: DataRendererOrdering;
  displayProperties: DisplayProperty[];
}

export type DataRendererFilterState = Partial<Record<FilterCategory, string[]>>;

export interface DataRendererOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface DataRendererFilterOption {
  value: string;
  label: string;
}

export interface DataRendererFilterCategory {
  id: FilterCategory;
  label: string;
  options: DataRendererFilterOption[];
}

export interface DataRendererTagOption {
  value: string;
  label: string;
  color?: string;
  icon?: string | null;
}

export interface DataRendererTagDefinition {
  name: string;
  label: string;
  options: DataRendererTagOption[];
}

export interface DataRendererTag {
  name: string;
  value: string;
}

export interface DataRendererRow {
  id: string;
  ticketId: string;
  title: string;
  status?: string | null;
  statusColor?: string;
  assignee?: string | null;
  tags?: DataRendererTag[];
  updatedAt?: string | null;
  parentPath?: string[];
  isSubIssue?: boolean;
}

export const DEFAULT_DATA_RENDERER_SETTINGS: DataRendererSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: {
    field: "manual",
    direction: "asc",
  },
  displayProperties: [],
};

export const DEFAULT_GROUPING_OPTIONS: DataRendererOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "No grouping" },
];

export const DEFAULT_ORDERING_OPTIONS: DataRendererOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
  { value: "ticketId", label: "ID" },
];

export const DEFAULT_DISPLAY_PROPERTY_OPTIONS: DataRendererOption<DisplayProperty>[] = [
  { value: "id", label: "ID" },
  { value: "status", label: "Status" },
  { value: "updated", label: "Updated" },
];

export const isTagKey = (key: string): key is `tag:${string}` => key.startsWith("tag:");

export const toTagName = (key: `tag:${string}`) => key.slice(4);
