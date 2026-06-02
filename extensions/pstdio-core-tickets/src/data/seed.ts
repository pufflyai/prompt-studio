import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { putStatus, putTag, statusesCollection, tagsCollection } from "./collections";
import type { StoredStatus, StoredTag, StoredTagOption } from "./types";

type StatusSeed = Omit<StoredStatus, "id">;

export const DEFAULT_STATUSES: StatusSeed[] = [
  {
    name: "Backlog",
    color: "gray",
    sortOrder: 0,
    isDefault: false,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "Todo",
    color: "blue",
    sortOrder: 1,
    isDefault: true,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "In Progress",
    color: "yellow",
    sortOrder: 2,
    isDefault: false,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "In Review",
    color: "purple",
    sortOrder: 3,
    isDefault: false,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    name: "Done",
    color: "green",
    sortOrder: 4,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: ["archive_all"],
  },
];

// Idempotent: seeds the default board columns only when the project has none yet.
export const seedDefaultStatuses = async (storage: ExtensionStorageApi) => {
  const existing = await statusesCollection(storage).list();
  if (existing.length > 0) return existing;

  const created: StoredStatus[] = [];
  for (const seed of DEFAULT_STATUSES) {
    created.push(await putStatus(storage, { ...seed, id: crypto.randomUUID() }));
  }
  return created;
};

const option = (name: string, color: string, sortOrder: number): StoredTagOption => ({
  id: crypto.randomUUID(),
  name,
  color,
  sortOrder,
  icon: null,
  description: null,
});

type TagSeed = () => Omit<StoredTag, "id">;

const DEFAULT_TAGS: TagSeed[] = [
  () => ({
    name: "Priority",
    type: "single_select",
    sortOrder: 0,
    options: [
      option("Low", "gray", 0),
      option("Medium", "blue", 1),
      option("High", "orange", 2),
      option("Urgent", "red", 3),
    ],
  }),
  () => ({
    name: "Type",
    type: "multi_select",
    sortOrder: 1,
    options: [option("Bug", "red", 0), option("Feature", "green", 1), option("Chore", "gray", 2)],
  }),
];

// Idempotent: seeds default tag definitions only when the project has none yet.
export const seedDefaultTags = async (storage: ExtensionStorageApi) => {
  const existing = await tagsCollection(storage).list();
  if (existing.length > 0) return existing;

  const created: StoredTag[] = [];
  for (const seed of DEFAULT_TAGS) {
    created.push(await putTag(storage, { ...seed(), id: crypto.randomUUID() }));
  }
  return created;
};
