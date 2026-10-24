import { expect, test } from "bun:test";
import { createMemoryStorage, createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { TAGS_COLLECTION, TICKETS_COLLECTION, ticketsCollection } from "./collections";
import { migratePlannerStorage } from "./migrate-storage";
import type { StoredTag } from "./types";

const option = (id: string, sortOrder: number) => ({
  id,
  name: id,
  color: "gray",
  sortOrder,
  icon: null,
  description: null,
});

const tags: Record<string, StoredTag> = {
  "default-priority": {
    id: "default-priority",
    name: "Priority",
    type: "single_select",
    sortOrder: 0,
    options: [option("default-priority-low", 0), option("default-priority-high", 1)],
  },
  track: {
    id: "track",
    name: "Track",
    type: "single_select",
    sortOrder: 1,
    // Stored out of order: the option order decides, not the list position.
    options: [option("ui", 1), option("api", 0)],
  },
  flags: { id: "flags", name: "Flags", type: "multi_select", sortOrder: 2, options: [option("a", 0), option("b", 1)] },
};

const ticket = (id: string, tagIds: string[], extra: Record<string, unknown> = {}) => ({
  id,
  shorthand: id.toUpperCase(),
  title: id,
  content: `# ${id}`,
  statusId: "ready",
  tagIds,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

// The draft holds two Track values, which list-shaped tags allowed.
const tickets = {
  active: ticket("active", ["default-priority-high", "b", "a", "unknown-option"]),
  draft: ticket("draft", ["ui", "api", "default-priority-low"], { draft: true }),
  archived: ticket("archived", ["ui"], { archived: true }),
  untagged: ticket("untagged", []),
  // A newer edit that ran before the upgrade wrote `tags` next to the old list.
  edited: ticket("edited", ["default-priority-low", "ui"], { tags: { "default-priority": "default-priority-high" } }),
};

const seed = { collections: { [TAGS_COLLECTION]: tags, [TICKETS_COLLECTION]: tickets } };

const expected = {
  active: { "default-priority": "default-priority-high", flags: ["a", "b"] },
  draft: { "default-priority": "default-priority-low", track: "api" },
  archived: { track: "ui" },
  untagged: {},
  edited: { "default-priority": "default-priority-high", track: "ui" },
};

const storedTags = async (storage: Parameters<typeof ticketsCollection>[0]) =>
  Object.fromEntries((await ticketsCollection(storage).list()).map(({ id, tags, ...rest }) => [id, { tags, rest }]));

const upgrade = async (storage: Parameters<typeof ticketsCollection>[0]) => {
  await storage.migrate(3, async () => {});
  await migratePlannerStorage(makeCommandContext({ storage, params: {} }));
};

test("the storage upgrade stores ticket tags by tag ID with one value per single-select", async () => {
  const storage = createMemoryStorage(seed);

  await upgrade(storage);

  const stored = await storedTags(storage);
  expect(Object.fromEntries(Object.entries(stored).map(([id, { tags }]) => [id, tags]))).toEqual(expected);
  for (const { rest } of Object.values(stored)) expect(rest).not.toHaveProperty("tagIds");
  expect(stored.draft.rest).toMatchObject({ draft: true, content: "# draft" });

  await migratePlannerStorage(makeCommandContext({ storage, params: {} }));
  expect(await storedTags(storage)).toEqual(stored);
});

test("two devices that upgrade offline store the same tags", async () => {
  const pair = await createMemoryStorageDevices(seed);
  for (const storage of pair.devices) await upgrade(storage);
  const [first, second] = await Promise.all(pair.devices.map(storedTags));
  expect(second).toEqual(first);

  await pair.merge();

  for (const storage of pair.devices) expect(await storedTags(storage)).toEqual(first);
});
