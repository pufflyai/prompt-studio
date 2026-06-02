import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { putStatus, putTag, statusesCollection, tagsCollection } from "./collections";
import { sortedBySortOrder } from "./sort";
import type { StoredStatus, StoredTag, StoredTagOption } from "./types";

const statusSeedPromises = new WeakMap<ExtensionStorageApi, Promise<StoredStatus[]>>();
const tagSeedPromises = new WeakMap<ExtensionStorageApi, Promise<StoredTag[]>>();
const STATUS_SEED_MARKER = "__pstdio-core-tickets:default-statuses-seeded";
const TAG_SEED_MARKER = "__pstdio-core-tickets:default-tags-seeded";

export const DEFAULT_STATUSES: StoredStatus[] = [
  {
    id: "default-backlog",
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
    id: "default-todo",
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
    id: "default-in-progress",
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
    id: "default-in-review",
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
    id: "default-done",
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

const defaultStatusIds = new Set(DEFAULT_STATUSES.map((status) => status.id));
const isOnlyDefaultStatuses = (statuses: StoredStatus[]) => statuses.every((status) => defaultStatusIds.has(status.id));

// Idempotent: seeds the default board columns only when the project has none yet.
export const seedDefaultStatuses = async (storage: ExtensionStorageApi) => {
  const pending = statusSeedPromises.get(storage);
  if (pending) return pending;

  const promise = (async () => {
    const [existing, seeded] = await Promise.all([statusesCollection(storage).list(), storage.get(STATUS_SEED_MARKER)]);
    if (seeded || (existing.length > 0 && !isOnlyDefaultStatuses(existing))) {
      if (!seeded) await storage.set(STATUS_SEED_MARKER, true);
      return existing;
    }

    await Promise.all(DEFAULT_STATUSES.map((seed) => putStatus(storage, seed)));
    await storage.set(STATUS_SEED_MARKER, true);
    return sortedBySortOrder(await statusesCollection(storage).list());
  })();
  statusSeedPromises.set(storage, promise);
  try {
    return await promise;
  } finally {
    statusSeedPromises.delete(storage);
  }
};

const option = (id: string, name: string, color: string, sortOrder: number): StoredTagOption => ({
  id,
  name,
  color,
  sortOrder,
  icon: null,
  description: null,
});

type TagSeed = () => StoredTag;

export const DEFAULT_TAGS: TagSeed[] = [
  () => ({
    id: "default-priority",
    name: "Priority",
    type: "single_select",
    sortOrder: 0,
    options: [
      option("default-priority-low", "Low", "gray", 0),
      option("default-priority-medium", "Medium", "blue", 1),
      option("default-priority-high", "High", "orange", 2),
      option("default-priority-urgent", "Urgent", "red", 3),
    ],
  }),
  () => ({
    id: "default-type",
    name: "Type",
    type: "multi_select",
    sortOrder: 1,
    options: [
      option("default-type-bug", "Bug", "red", 0),
      option("default-type-feature", "Feature", "green", 1),
      option("default-type-chore", "Chore", "gray", 2),
    ],
  }),
];

const defaultTagIds = new Set(DEFAULT_TAGS.map((seed) => seed().id));
const isOnlyDefaultTags = (tags: StoredTag[]) => tags.every((tag) => defaultTagIds.has(tag.id));

// Idempotent: seeds default tag definitions only when the project has none yet.
export const seedDefaultTags = async (storage: ExtensionStorageApi) => {
  const pending = tagSeedPromises.get(storage);
  if (pending) return pending;

  const promise = (async () => {
    const [existing, seeded] = await Promise.all([tagsCollection(storage).list(), storage.get(TAG_SEED_MARKER)]);
    if (seeded || (existing.length > 0 && !isOnlyDefaultTags(existing))) {
      if (!seeded) await storage.set(TAG_SEED_MARKER, true);
      return existing;
    }

    await Promise.all(DEFAULT_TAGS.map((seed) => putTag(storage, seed())));
    await storage.set(TAG_SEED_MARKER, true);
    return sortedBySortOrder(await tagsCollection(storage).list());
  })();
  tagSeedPromises.set(storage, promise);
  try {
    return await promise;
  } finally {
    tagSeedPromises.delete(storage);
  }
};
