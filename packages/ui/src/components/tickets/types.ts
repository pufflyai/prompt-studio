export type ViewMode = "board" | "list";

export type GroupingField = "status" | "assignee" | "none";

export type OrderingField = "manual" | "updated" | "title" | "ticketId";

export type SortDirection = "asc" | "desc";

export type DisplayProperty = "id" | "status" | "assignee" | "labels" | "updated";

export type FilterCategory = "status" | "assignee" | "labels";

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
  displayProperties: ["labels"],
};

export const DEFAULT_GROUPING_OPTIONS: WorkspaceOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "No grouping" },
];

export const DEFAULT_ORDERING_OPTIONS: WorkspaceOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
  { value: "ticketId", label: "ID" },
];

export const DEFAULT_DISPLAY_PROPERTY_OPTIONS: WorkspaceOption<DisplayProperty>[] = [
  { value: "id", label: "ID" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "labels", label: "Labels" },
  { value: "updated", label: "Updated" },
];
