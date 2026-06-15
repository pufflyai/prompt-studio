import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { sortedBySortOrder } from "../utils/sort";
import { putStatus, putTag, statusesCollection, tagsCollection } from "./collections";
import type { StoredStatus, StoredTag, StoredTagOption } from "./types";

const statusSeedPromises = new WeakMap<ExtensionStorageApi, Promise<StoredStatus[]>>();
const tagSeedPromises = new WeakMap<ExtensionStorageApi, Promise<StoredTag[]>>();
const STATUS_SEED_MARKER = "__pstdio-planner:default-statuses-seeded";
const TAG_SEED_MARKER = "__pstdio-planner:default-tags-seeded";

export const DEFAULT_STATUSES: StoredStatus[] = [
  {
    id: "default-backlog",
    name: "Backlog",
    color: "gray",
    icon: null,
    sortOrder: 0,
    isDefault: true,
    canCreate: true,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "default-ready",
    name: "Ready",
    color: "green",
    icon: null,
    sortOrder: 1,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "default-in-progress",
    name: "In Progress",
    color: "blue",
    icon: null,
    sortOrder: 2,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "default-blocked",
    name: "Blocked",
    color: "red",
    icon: null,
    sortOrder: 3,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "default-in-review",
    name: "In Review",
    color: "yellow",
    icon: null,
    sortOrder: 4,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "default-done",
    name: "Done",
    color: "green",
    icon: null,
    sortOrder: 5,
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

const option = (
  id: string,
  name: string,
  color: string,
  sortOrder: number,
  icon: string | null = null,
): StoredTagOption => ({
  id,
  name,
  color,
  sortOrder,
  icon,
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
      option("default-priority-low", "Low", "gray", 0, "flag"),
      option("default-priority-medium", "Medium", "blue", 1, "gauge"),
      option("default-priority-high", "High", "orange", 2, "flame"),
      option("default-priority-urgent", "Urgent", "red", 3, "alert-triangle"),
    ],
  }),
  () => ({
    id: "default-type",
    name: "Type",
    type: "single_select",
    sortOrder: 1,
    options: [
      option("default-type-bug", "Bug", "red", 0, "bug"),
      option("default-type-feature", "Feature", "green", 1, "sparkles"),
      option("default-type-chore", "Chore", "gray", 2, "wrench"),
    ],
  }),
  () => ({
    id: "default-complexity",
    name: "Complexity",
    type: "single_select",
    sortOrder: 2,
    options: [
      option("default-complexity-simple", "Simple", "green", 0),
      option("default-complexity-moderate", "Moderate", "amber", 1),
      option("default-complexity-complex", "Complex", "red", 2),
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
