import type { AttributeDescriptor, KanbanRendererRow } from "./types";

export const attributes: AttributeDescriptor[] = [
  {
    id: "id",
    label: "ID",
    type: { kind: "string" },
    displayable: true,
  },
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo", color: "gray", icon: "circle" },
        { value: "in_progress", label: "In progress", color: "blue", icon: "gauge" },
        { value: "done", label: "Done", color: "green", icon: "check-circle" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
    editable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "component",
    label: "Component",
    type: {
      kind: "enum",
      options: [
        { value: "backend", label: "Backend", color: "blue" },
        { value: "frontend", label: "Frontend", color: "purple" },
        { value: "devops", label: "DevOps", color: "orange" },
        { value: "docs", label: "Docs", color: "cyan" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "high", label: "High", color: "red" },
        { value: "medium", label: "Medium", color: "yellow" },
        { value: "low", label: "Low", color: "green" },
      ],
    },
    filterable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
  {
    id: "labels",
    label: "Labels",
    type: {
      kind: "enum-multi",
      options: [
        { value: "bug", label: "Bug", color: "red" },
        { value: "regression", label: "Regression", color: "orange" },
        { value: "good-first-issue", label: "Good first issue", color: "green" },
      ],
    },
    filterable: true,
    displayable: true,
  },
];

export interface StoryRow extends KanbanRendererRow {
  attributes: {
    id?: string;
    status: string;
    assignee: string;
    component: string;
    priority?: string;
    updated: string;
    labels?: string[];
  };
}

export const initialRows: StoryRow[] = [
  {
    id: "1",
    title: "Set up API authentication",
    attributes: {
      status: "todo",
      assignee: "Alex",
      component: "backend",
      priority: "high",
      updated: "2026-03-15T12:00:00.000Z",
      labels: ["bug"],
    },
  },
  {
    id: "2",
    title: "Build row list interactions",
    attributes: {
      status: "in_progress",
      assignee: "Sam",
      component: "frontend",
      priority: "medium",
      updated: "2026-03-16T12:00:00.000Z",
    },
  },
  {
    id: "3",
    title: "Write docs",
    attributes: { status: "done", assignee: "Taylor", component: "docs", updated: "2026-03-17T12:00:00.000Z" },
  },
  {
    id: "4",
    title: "Design database schema",
    attributes: {
      status: "todo",
      assignee: "Sam",
      component: "backend",
      priority: "medium",
      updated: "2026-03-14T10:00:00.000Z",
    },
  },
  {
    id: "5",
    title: "Implement search filters",
    attributes: {
      status: "in_progress",
      assignee: "Alex",
      component: "frontend",
      priority: "high",
      updated: "2026-03-18T08:00:00.000Z",
      labels: ["regression"],
    },
  },
  {
    id: "6",
    title: "Set up CI pipeline",
    attributes: { status: "done", assignee: "Jordan", component: "devops", updated: "2026-03-13T14:00:00.000Z" },
  },
  {
    id: "7",
    title: "Add error tracking integration",
    attributes: {
      status: "todo",
      assignee: "Jordan",
      component: "backend",
      priority: "low",
      updated: "2026-03-12T09:00:00.000Z",
    },
  },
  {
    id: "8",
    title: "Create onboarding flow",
    attributes: {
      status: "in_progress",
      assignee: "Taylor",
      component: "frontend",
      priority: "high",
      updated: "2026-03-19T11:00:00.000Z",
      labels: ["good-first-issue"],
    },
  },
];
