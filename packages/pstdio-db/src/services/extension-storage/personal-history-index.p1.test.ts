import { afterEach, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createPersonalHistoryIndex } from "./personal-history-index";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

test("head-only index updates preserve visible revisions and unchanged row identity", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "visible-project", name: "Visible", shorthand: "V", created_at: now, updated_at: now });
  const index = createPersonalHistoryIndex(db);
  const owner = { workbenchId: "visible-project", extensionId: "private" };
  await index.apply(owner, null, [{ deviceId: "laptop", kind: "sessions", id: "one", value: { id: "one" } }]);
  const row = await index.get(owner, "sessions", "one");
  const revision = await index.visibleRevision(owner);
  await index.apply(owner, null, [
    { deviceId: "laptop", kind: "heads", id: "one", value: { id: "one", sequence: 1 } },
    { deviceId: "laptop", kind: "publications", id: "one", value: { id: "one", head: 1, version: "complete" } },
  ]);
  expect(await index.visibleRevision(owner)).toBe(revision);
  expect(await index.get(owner, "sessions", "one")).toBe(row);
  await index.apply(owner, null, [{ deviceId: "laptop", kind: "sessions", id: "two", value: { id: "two" } }]);
  expect(await index.visibleRevision(owner)).not.toBe(revision);
  expect(await index.get(owner, "sessions", "one")).toBe(row);
});

test("canonical device snapshots exclude a newer durable optimistic index edit", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "overlay-project", name: "Overlay", shorthand: "O", created_at: now, updated_at: now });
  const index = createPersonalHistoryIndex(db);
  const owner = { workbenchId: "overlay-project", extensionId: "private" };
  const delta = (title: string) => ({ deviceId: "laptop", kind: "sessions", id: "one", value: { id: "one", title } });
  await index.apply(owner, null, [delta("first")], "first-id");
  await index.apply(owner, null, [delta("newer")], "newer-id");
  await index.accept(owner, "laptop", 1, [{ entryId: "first-id", sequence: 1, index: 0, delta: delta("first") }]);
  expect((await index.get(owner, "sessions", "one"))?.title).toBe("newer");
  expect((await index.sourcePage(owner, "laptop"))[0]?.delta.value).toEqual({ id: "one", title: "first" });
  await index.accept(owner, "laptop", 2, [{ entryId: "newer-id", sequence: 2, index: 0, delta: delta("newer") }]);
  expect(await index.sourcePosition(owner, "laptop")).toBe(2);
});

test("a migrated full copy seeds missing device history without resurrecting normal deletions", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "seed-project", name: "Seed", shorthand: "S", created_at: now, updated_at: now });
  const index = createPersonalHistoryIndex(db);
  const owner = { workbenchId: "seed-project", extensionId: "private" };
  await index.apply(owner, null, [
    {
      deviceId: "offline-writer",
      kind: "sessions",
      id: "saved",
      value: { id: "saved", title: "Seed B" },
      seedId: "device-b",
    },
  ]);
  await index.apply(owner, null, [
    {
      deviceId: "offline-writer",
      kind: "sessions",
      id: "saved",
      value: { id: "saved", title: "Seed A" },
      seedId: "device-a",
    },
  ]);
  expect((await index.read(owner, "sessions"))[0]?.title).toBe("Seed A");
  await index.apply(owner, null, [{ deviceId: "offline-writer", kind: "sessions", id: "saved", value: null }]);
  await index.apply(owner, null, [
    { deviceId: "offline-writer", kind: "sessions", id: "saved", value: { id: "saved" }, seedId: "device-0" },
  ]);
  expect(await index.read(owner, "sessions")).toEqual([]);
});

test("a private device index commits only changed rows with its cursor and retains account isolation", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "project", name: "History", shorthand: "H", created_at: now, updated_at: now });
  const index = createPersonalHistoryIndex(db);
  const owner = { workbenchId: "project", extensionId: "private-alice" };
  await index.apply(owner, "cursor-one", [
    { deviceId: "laptop", kind: "sessions", id: "one", value: { id: "one", title: "old" } },
    { deviceId: "desktop", kind: "sessions", id: "two", value: { id: "two" } },
  ]);
  await index.apply(owner, "cursor-two", [{ deviceId: "laptop", kind: "sessions", id: "one", value: null }]);
  const restarted = createPersonalHistoryIndex(db);
  expect(await restarted.read(owner, "sessions")).toEqual([{ id: "two" }]);
  expect(await restarted.cursor(owner)).toBe("cursor-two");
  expect(await restarted.read({ ...owner, extensionId: "private-bob" }, "sessions")).toEqual([]);
  expect(await restarted.device(owner, "sessions", "laptop")).toEqual([]);
});

test("one device page preserves repeated-row precedence and ignores older canonical occurrences", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: "repeated", name: "Repeated index changes", shorthand: "R", created_at: now, updated_at: now });
  const owner = { workbenchId: "repeated", extensionId: "private" };
  const index = createPersonalHistoryIndex(db);
  const delta = (value: { id: string; title: string } | null, seedId?: string) => ({
    kind: "sessions",
    deviceId: "laptop",
    id: "one",
    value,
    seedId,
  });
  await index.apply(owner, null, [
    delta({ id: "one", title: "Seed B" }, "b"),
    delta(null),
    delta({ id: "one", title: "Seed A" }, "a"),
  ]);
  expect(await index.read(owner, "sessions")).toEqual([]);
  await index.accept(owner, "laptop", 3, [
    { entryId: "newer", sequence: 2, index: 0, delta: delta({ id: "one", title: "Newer" }) },
    { entryId: "older", sequence: 1, index: 0, delta: delta({ id: "one", title: "Older" }) },
    { entryId: "deleted", sequence: 3, index: 0, delta: delta(null) },
  ]);
  expect(await index.read(owner, "sessions")).toEqual([]);
  expect((await index.sourcePage(owner, "laptop"))[0]).toMatchObject({
    entryId: "deleted",
    sequence: 3,
    delta: { value: null },
  });
  expect(await index.sourcePosition(owner, "laptop")).toBe(3);
});
