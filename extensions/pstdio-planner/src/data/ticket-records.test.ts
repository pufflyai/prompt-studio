import { expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage, createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { TAGS_COLLECTION, TICKETS_COLLECTION } from "./collections";
import { ticketRecords } from "./ticket-records";
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
  // A newer build wrote `tags` next to the old list.
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

const readTags = async (storage: ExtensionStorageApi) =>
  Object.fromEntries((await ticketRecords(storage).list()).map(({ id, tags }) => [id, tags]));

test("tickets with tagIds read as tags by tag ID with one value per single-select", async () => {
  const storage = createMemoryStorage(seed);

  expect(await readTags(storage)).toEqual(expected);
  expect((await ticketRecords(storage).get("draft"))?.tags).toEqual(expected.draft);
});

test("the next save of a ticket with tagIds stores only tags", async () => {
  const storage = createMemoryStorage(seed);
  const records = ticketRecords(storage);
  const draft = await records.get("draft");

  await records.put("draft", { ...draft!, content: "# edited" });

  expect(await storage.collection(TICKETS_COLLECTION).get("draft")).toEqual({
    ...draft,
    content: "# edited",
    tags: expected.draft,
  });
  expect(await storage.collection(TICKETS_COLLECTION).get("draft")).not.toHaveProperty("tagIds");
});

test("two devices that save tickets with tagIds offline store the same tags", async () => {
  const pair = await createMemoryStorageDevices(seed);
  for (const storage of pair.devices) {
    const records = ticketRecords(storage);
    for (const record of await records.list()) await records.put(record.id, record);
  }

  await pair.merge();

  for (const storage of pair.devices) expect(await readTags(storage)).toEqual(expected);
});

test("a ticket with tagIds that syncs in from an older build shows its tags", async () => {
  const pair = await createMemoryStorageDevices({ collections: { [TAGS_COLLECTION]: tags } });
  const [current, older] = pair.devices;
  // A device on an older build creates a ticket in the old shape while offline.
  await older.collection(TICKETS_COLLECTION).put("late", ticket("late", ["ui", "api", "b"]));

  await pair.merge();

  expect((await ticketRecords(current).get("late"))?.tags).toEqual({ track: "api", flags: ["b"] });
});
