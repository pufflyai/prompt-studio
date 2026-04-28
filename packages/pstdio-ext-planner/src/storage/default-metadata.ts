import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

const DEFAULT_STATUSES = [
  {
    id: "backlog",
    name: "backlog",
    color: "gray",
    isDefault: true,
    canDragOut: true,
    canDragIn: true,
    canCreate: true,
    columnActions: [],
  },
  {
    id: "ready",
    name: "ready",
    color: "green",
    isDefault: false,
    canDragOut: true,
    canDragIn: true,
    canCreate: false,
    columnActions: [],
  },
  {
    id: "wip",
    name: "wip",
    color: "blue",
    isDefault: false,
    canDragOut: true,
    canDragIn: true,
    canCreate: false,
    columnActions: [],
  },
  {
    id: "blocked",
    name: "blocked",
    color: "red",
    isDefault: false,
    canDragOut: true,
    canDragIn: true,
    canCreate: false,
    columnActions: [],
  },
  {
    id: "review",
    name: "review",
    color: "yellow",
    isDefault: false,
    canDragOut: true,
    canDragIn: true,
    canCreate: false,
    columnActions: [],
  },
  {
    id: "done",
    name: "done",
    color: "green",
    isDefault: false,
    canDragOut: true,
    canDragIn: true,
    canCreate: false,
    columnActions: ["archive_all"],
  },
] as const;

const DEFAULT_TAGS = [
  {
    id: "label",
    name: "label",
    type: "single_select" as const,
    options: [
      { id: "bug", name: "bug", color: "red", icon: "bug", sortOrder: 1 },
      { id: "feature", name: "feature", color: "blue", icon: "sparkles", sortOrder: 2 },
      { id: "documentation", name: "documentation", color: "purple", icon: "book-open", sortOrder: 3 },
      { id: "chore", name: "chore", color: "gray", icon: "wrench", sortOrder: 4 },
    ],
  },
  {
    id: "complexity",
    name: "complexity",
    type: "single_select" as const,
    options: [
      { id: "low", name: "low", color: "green", icon: "gauge", sortOrder: 1 },
      { id: "medium", name: "medium", color: "orange", icon: "gauge", sortOrder: 2 },
      { id: "high", name: "high", color: "red", icon: "gauge", sortOrder: 3 },
    ],
  },
  {
    id: "priority",
    name: "priority",
    type: "single_select" as const,
    options: [
      { id: "P1", name: "P1", color: "red", icon: "alert-triangle", sortOrder: 1 },
      { id: "P2", name: "P2", color: "orange", icon: "alert-triangle", sortOrder: 2 },
      { id: "P3", name: "P3", color: "yellow", icon: "alert-triangle", sortOrder: 3 },
    ],
  },
] as const;

export const seedDefaultPlannerMetadata = async (storage: ExtensionStorageApi) => {
  const statuses = storage.collection("statuses");
  const tags = storage.collection("tags");
  const tagOptions = storage.collection("tag_options");

  if ((await statuses.list()).length === 0) {
    await Promise.all(
      DEFAULT_STATUSES.map((status, index) =>
        statuses.put(status.id, {
          ...status,
          sortOrder: index + 1,
        }),
      ),
    );
  }

  if ((await tags.list()).length > 0 || (await tagOptions.list()).length > 0) return;

  for (const tag of DEFAULT_TAGS) {
    await tags.put(tag.id, { id: tag.id, name: tag.name, type: tag.type });
    await Promise.all(
      tag.options.map((option) =>
        tagOptions.put(option.id, {
          ...option,
          tagId: tag.id,
          description: null,
        }),
      ),
    );
  }
};
