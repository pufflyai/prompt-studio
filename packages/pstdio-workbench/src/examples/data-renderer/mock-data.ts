import type {
  DataRendererFilterCategory,
  DataRendererOption,
  DataRendererRow,
  DataRendererTagDefinition,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { ViewDisplayOptions } from "../../core";

export const dataRendererStoryProjectId = "data-renderer-story-project";
export const dataRendererStoryRendererId = "data-renderer.story.rows";
export const dataRendererStoryWidgetId = "data-renderer.story.rows";
export const dataRendererStoryViewKind = "data-renderer.story.row";

export interface StoryRow extends DataRendererRow {
  priority: string;
  area: string;
}

const statusColumns = [
  { id: "backlog", label: "Backlog", color: "gray" },
  { id: "in-progress", label: "In progress", color: "blue" },
  { id: "review", label: "Review", color: "purple" },
  { id: "done", label: "Done", color: "green" },
];

export const storyStatusColumns = statusColumns;

const baseRows: Omit<StoryRow, "ticketId" | "tags" | "statusColor">[] = [
  {
    id: "DR-1",
    title: "Schema-aware grouping",
    status: "in-progress",
    assignee: "Aure",
    priority: "high",
    area: "renderer",
    updatedAt: "2026-05-17T09:00:00Z",
  },
  {
    id: "DR-2",
    title: "Saved-view menu wiring",
    status: "review",
    assignee: "Mika",
    priority: "high",
    area: "workbench",
    updatedAt: "2026-05-16T18:30:00Z",
  },
  {
    id: "DR-3",
    title: "Filter expression mapping",
    status: "backlog",
    assignee: "Sam",
    priority: "medium",
    area: "workbench",
    updatedAt: "2026-05-15T12:00:00Z",
  },
  {
    id: "DR-4",
    title: "executeQuery callbacks",
    status: "in-progress",
    assignee: "Aure",
    priority: "medium",
    area: "renderer",
    updatedAt: "2026-05-15T10:15:00Z",
  },
  {
    id: "DR-5",
    title: "Display state isolation",
    status: "done",
    assignee: "Nora",
    priority: "low",
    area: "renderer",
    updatedAt: "2026-05-14T16:45:00Z",
  },
  {
    id: "DR-6",
    title: "Board column actions",
    status: "review",
    assignee: "Mika",
    priority: "low",
    area: "ui",
    updatedAt: "2026-05-14T11:00:00Z",
  },
  {
    id: "DR-7",
    title: "Refresh on data change",
    status: "backlog",
    assignee: "Sam",
    priority: "medium",
    area: "renderer",
    updatedAt: "2026-05-13T08:20:00Z",
  },
  {
    id: "DR-8",
    title: "Storybook smoke test",
    status: "in-progress",
    assignee: "Aure",
    priority: "low",
    area: "ui",
    updatedAt: "2026-05-12T14:30:00Z",
  },
];

export const storyRows: StoryRow[] = baseRows.map((row) => ({
  ...row,
  ticketId: row.id,
  statusColor: statusColumns.find((column) => column.id === row.status)?.color,
  tags: [
    { name: "priority", value: row.priority },
    { name: "area", value: row.area },
  ],
}));

export const storyTagDefinitions: DataRendererTagDefinition[] = [
  {
    name: "priority",
    label: "Priority",
    options: [
      { value: "high", label: "High", color: "red" },
      { value: "medium", label: "Medium", color: "yellow" },
      { value: "low", label: "Low", color: "gray" },
    ],
  },
  {
    name: "area",
    label: "Area",
    options: [
      { value: "renderer", label: "Renderer", color: "blue" },
      { value: "workbench", label: "Workbench", color: "purple" },
      { value: "ui", label: "UI", color: "green" },
    ],
  },
];

export const storyGroupingOptions: DataRendererOption<GroupingField>[] = [
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "tag:priority", label: "Priority" },
  { value: "tag:area", label: "Area" },
  { value: "none", label: "None" },
];

export const storyOrderingOptions: DataRendererOption<OrderingField>[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
];

export const storyDisplayPropertyOptions: DataRendererOption<DisplayProperty>[] = [
  { value: "id", label: "ID" },
  { value: "status", label: "Status" },
  { value: "assignee", label: "Assignee" },
  { value: "updated", label: "Updated" },
  { value: "tag:priority", label: "Priority" },
  { value: "tag:area", label: "Area" },
];

export const storyFilterCategories: DataRendererFilterCategory[] = [
  {
    id: "status",
    label: "Status",
    options: statusColumns.map((column) => ({ value: column.id, label: column.label, color: column.color })),
  },
  {
    id: "assignee",
    label: "Assignee",
    options: [
      { value: "Aure", label: "Aure" },
      { value: "Mika", label: "Mika" },
      { value: "Nora", label: "Nora" },
      { value: "Sam", label: "Sam" },
    ],
  },
  {
    id: "tag:priority",
    label: "Priority",
    options: storyTagDefinitions[0]!.options.map((option) => ({
      value: option.value,
      label: option.label,
      color: option.color,
    })),
  },
];

export const storyDefaultDisplay: ViewDisplayOptions = {
  layout: "board",
  columns: ["id", "status", "assignee", "tag:priority"],
  groupBy: ["status"],
  density: "compact",
};
