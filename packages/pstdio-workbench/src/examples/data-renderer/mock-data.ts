import type { AttributeDescriptor, AttributesSource, DataRendererRow } from "@pstdio/ui";

export const dataRendererStoryRendererId = "data-renderer.story.rows";
export const dataRendererStoryWidgetId = "data-renderer.story.rows";
export const dataRendererStoryViewKind = "data-renderer.story.row";
export const dataRendererStoryEditorWidgetId = "data-renderer.story.editor";

export interface StoryRow extends DataRendererRow {
  attributes: Record<string, unknown>;
}

const INITIAL_STORY_ATTRIBUTES: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "backlog", label: "Backlog", color: "gray" },
        { value: "in-progress", label: "In progress", color: "blue" },
        { value: "review", label: "Review", color: "purple" },
        { value: "done", label: "Done", color: "green" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
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
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "high", label: "High", color: "red" },
        { value: "medium", label: "Medium", color: "yellow" },
        { value: "low", label: "Low", color: "gray" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "area",
    label: "Area",
    type: {
      kind: "enum",
      options: [
        { value: "renderer", label: "Renderer", color: "blue" },
        { value: "workbench", label: "Workbench", color: "purple" },
        { value: "ui", label: "UI", color: "green" },
      ],
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    sortable: true,
    displayable: true,
  },
];

export interface StorySchemaStore {
  source: AttributesSource;
  getAttributes: () => AttributeDescriptor[];
  setAttributes: (next: AttributeDescriptor[]) => void;
}

const createStorySchemaStore = (initial: AttributeDescriptor[]): StorySchemaStore => {
  let attributes = initial;
  const listeners = new Set<() => void>();

  return {
    source: {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getSnapshot: () => attributes,
    },
    getAttributes: () => attributes,
    setAttributes: (next) => {
      attributes = next;
      for (const listener of listeners) listener();
    },
  };
};

// Module-scope store keeps the AttributesSource identity stable for the
// lifetime of the workbench example — the registered contribution, the
// schema editor modal, and any board-column config lookups all share it.
export const storySchemaStore = createStorySchemaStore(INITIAL_STORY_ATTRIBUTES);

const baseRows = [
  {
    id: "DR-1",
    title: "Schema-aware grouping",
    status: "in-progress",
    assignee: "Aure",
    priority: "high",
    area: "renderer",
    updated: "2026-05-17T09:00:00Z",
  },
  {
    id: "DR-2",
    title: "Toolbar state wiring",
    status: "review",
    assignee: "Mika",
    priority: "high",
    area: "workbench",
    updated: "2026-05-16T18:30:00Z",
  },
  {
    id: "DR-3",
    title: "Filter expression mapping",
    status: "backlog",
    assignee: "Sam",
    priority: "medium",
    area: "workbench",
    updated: "2026-05-15T12:00:00Z",
  },
  {
    id: "DR-4",
    title: "executeQuery callbacks",
    status: "in-progress",
    assignee: "Aure",
    priority: "medium",
    area: "renderer",
    updated: "2026-05-15T10:15:00Z",
  },
  {
    id: "DR-5",
    title: "Display state isolation",
    status: "done",
    assignee: "Nora",
    priority: "low",
    area: "renderer",
    updated: "2026-05-14T16:45:00Z",
  },
  {
    id: "DR-6",
    title: "Board column actions",
    status: "review",
    assignee: "Mika",
    priority: "low",
    area: "ui",
    updated: "2026-05-14T11:00:00Z",
  },
  {
    id: "DR-7",
    title: "Refresh on data change",
    status: "backlog",
    assignee: "Sam",
    priority: "medium",
    area: "renderer",
    updated: "2026-05-13T08:20:00Z",
  },
  {
    id: "DR-8",
    title: "Storybook smoke test",
    status: "in-progress",
    assignee: "Aure",
    priority: "low",
    area: "ui",
    updated: "2026-05-12T14:30:00Z",
  },
];

export const storyRows: StoryRow[] = baseRows.map(({ id, title, status, assignee, priority, area, updated }) => ({
  id,
  title,
  attributes: { status, assignee, priority, area, updated },
}));
