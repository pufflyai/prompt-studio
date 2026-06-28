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
    id: "default-refine",
    name: "Refine",
    color: "purple",
    icon: null,
    sortOrder: 1,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: [],
  },
  {
    id: "default-ready",
    name: "Ready",
    color: "green",
    icon: null,
    sortOrder: 2,
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
    sortOrder: 3,
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
    sortOrder: 4,
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
    sortOrder: 5,
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
    sortOrder: 6,
    isDefault: false,
    canCreate: false,
    canDragIn: true,
    canDragOut: true,
    columnActions: ["archive_all"],
  },
];

// Statuses introduced after the initial seed. The lazy backfill ensures
// existing projects pick them up without resetting custom columns; per-id
// markers prevent re-adding rows that a user deliberately deleted later.
export const POST_SEED_STATUS_BACKFILLS: StoredStatus[] = [
  DEFAULT_STATUSES.find((status) => status.id === "default-refine")!,
];
const statusBackfillMarker = (id: string) => `__pstdio-planner:backfill-status:${id}`;

const defaultStatusIds = new Set(DEFAULT_STATUSES.map((status) => status.id));
const isOnlyDefaultStatuses = (statuses: StoredStatus[]) => statuses.every((status) => defaultStatusIds.has(status.id));

const backfillStatuses = async (storage: ExtensionStorageApi, existing: StoredStatus[]) => {
  const haveById = new Map(existing.map((status) => [status.id, status]));
  let appended = false;

  for (const seed of POST_SEED_STATUS_BACKFILLS) {
    const marker = statusBackfillMarker(seed.id);
    if (await storage.get(marker)) continue;
    if (!haveById.has(seed.id)) {
      await putStatus(storage, seed);
      appended = true;
    }
    await storage.set(marker, true);
  }

  return appended;
};

// Idempotent: seeds the default board columns only when the project has none yet.
// Always runs the post-seed backfill so existing projects pick up newly added
// defaults (e.g. `Refine`) without resetting customised columns.
export const seedDefaultStatuses = async (storage: ExtensionStorageApi) => {
  const pending = statusSeedPromises.get(storage);
  if (pending) return pending;

  const promise = (async () => {
    const [existing, seeded] = await Promise.all([statusesCollection(storage).list(), storage.get(STATUS_SEED_MARKER)]);
    if (seeded || (existing.length > 0 && !isOnlyDefaultStatuses(existing))) {
      if (!seeded) await storage.set(STATUS_SEED_MARKER, true);
      const appended = await backfillStatuses(storage, existing);
      return appended ? sortedBySortOrder(await statusesCollection(storage).list()) : existing;
    }

    await Promise.all(DEFAULT_STATUSES.map((seed) => putStatus(storage, seed)));
    await storage.set(STATUS_SEED_MARKER, true);
    for (const seed of POST_SEED_STATUS_BACKFILLS) await storage.set(statusBackfillMarker(seed.id), true);
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
  () => ({
    id: "default-human-requested",
    name: "human_requested",
    type: "single_select",
    sortOrder: 3,
    options: [option("default-human-requested-true", "True", "amber", 0, "shield-user")],
  }),
];

// Tags introduced after the initial seed; backfilled lazily for existing
// projects, gated by per-id markers so user-deleted tags do not resurrect.
export const POST_SEED_TAG_BACKFILLS: TagSeed[] = [
  DEFAULT_TAGS.find((seed) => seed().id === "default-human-requested")!,
];
const tagBackfillMarker = (id: string) => `__pstdio-planner:backfill-tag:${id}`;

const defaultTagIds = new Set(DEFAULT_TAGS.map((seed) => seed().id));
const isOnlyDefaultTags = (tags: StoredTag[]) => tags.every((tag) => defaultTagIds.has(tag.id));

const backfillTags = async (storage: ExtensionStorageApi, existing: StoredTag[]) => {
  const haveById = new Map(existing.map((tag) => [tag.id, tag]));
  let appended = false;

  for (const seed of POST_SEED_TAG_BACKFILLS) {
    const tag = seed();
    const marker = tagBackfillMarker(tag.id);
    if (await storage.get(marker)) continue;
    if (!haveById.has(tag.id)) {
      await putTag(storage, tag);
      appended = true;
    }
    await storage.set(marker, true);
  }

  return appended;
};

// Idempotent: seeds default tag definitions only when the project has none yet.
// Post-seed backfill keeps existing projects in sync with newly added defaults
// (e.g. `human_requested`).
export const seedDefaultTags = async (storage: ExtensionStorageApi) => {
  const pending = tagSeedPromises.get(storage);
  if (pending) return pending;

  const promise = (async () => {
    const [existing, seeded] = await Promise.all([tagsCollection(storage).list(), storage.get(TAG_SEED_MARKER)]);
    if (seeded || (existing.length > 0 && !isOnlyDefaultTags(existing))) {
      if (!seeded) await storage.set(TAG_SEED_MARKER, true);
      const appended = await backfillTags(storage, existing);
      return appended ? sortedBySortOrder(await tagsCollection(storage).list()) : existing;
    }

    await Promise.all(DEFAULT_TAGS.map((seed) => putTag(storage, seed())));
    await storage.set(TAG_SEED_MARKER, true);
    for (const seed of POST_SEED_TAG_BACKFILLS) await storage.set(tagBackfillMarker(seed().id), true);
    return sortedBySortOrder(await tagsCollection(storage).list());
  })();
  tagSeedPromises.set(storage, promise);
  try {
    return await promise;
  } finally {
    tagSeedPromises.delete(storage);
  }
};
