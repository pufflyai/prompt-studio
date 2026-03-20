export type ViewMode = "board" | "list";

export type GroupingField = "status" | "complexity" | "assignee" | "priority" | "none";

export type OrderingField = "manual" | "updated" | "title" | "complexity" | "priority" | "ticketId";

export type SortDirection = "asc" | "desc";

export type DisplayProperty = "id" | "status" | "assignee" | "priority" | "complexity" | "labels" | "updated";

export type FilterCategory = "status" | "assignee" | "priority" | "complexity" | "labels";

export interface WorkspaceOrdering {
  field: OrderingField;
  direction: SortDirection;
}

export interface WorkspaceSettings {
  viewMode: ViewMode;
  columnGrouping: GroupingField;
  rowGrouping: GroupingField;
  ordering: WorkspaceOrdering;
  displayProperties: DisplayProperty[];
}

export type FilterState = Partial<Record<FilterCategory, string[]>>;

export interface WorkspaceOption<TValue extends string> {
  value: TValue;
  label: string;
}

export interface WorkspaceFilterOption {
  value: string;
  label: string;
}

export interface WorkspaceFilterCategory {
  id: FilterCategory;
  label: string;
  options: WorkspaceFilterOption[];
}

export interface WorkspaceTicket {
  id: string;
  ticketId: string;
  title: string;
  status?: string | null;
  statusColor?: string;
  assignee?: string | null;
  priority?: string | null;
  complexity?: string | null;
  labels?: string[];
  updatedAt?: string | null;
  parentPath?: string[];
  isSubIssue?: boolean;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: {
    field: "manual",
    direction: "asc",
  },
  displayProperties: ["complexity", "priority", "labels"],
};

export const DEFAULT_GROUPING_OPTIONS: WorkspaceOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "complexity", label: "Complexity" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "none", label: "No grouping" },
];

export const DEFAULT_ORDERING_OPTIONS: WorkspaceOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
  { value: "complexity", label: "Complexity" },
  { value: "priority", label: "Priority" },
  { value: "ticketId", label: "ID" },
];

export const DEFAULT_DISPLAY_PROPERTY_OPTIONS: WorkspaceOption<DisplayProperty>[] = [
  { value: "id", label: "ID" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "complexity", label: "Complexity" },
  { value: "labels", label: "Labels" },
  { value: "updated", label: "Updated" },
];
