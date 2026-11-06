import { afterEach, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createOrderedLogStore } from "./ordered-log-store";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
const fixture = async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(projects).values({ id, name: "Logs", shorthand: "L", created_at: now, updated_at: now });
  const address = {
    owner: { workbenchId: id, extensionId: "example.logs" },
    name: "runs",
    scope: "project",
    stream: "project",
    writerId: "laptop",
  };
  return { db, address, store: createOrderedLogStore(db, address) };
};

test("offline append is durable, immutable and follows a bounded cursor without duplicates", async () => {
  const { db, address, store } = await fixture();
  const first = await store.append({ run: 1 }, { id: "first" });
  expect((await store.read({ after: 0, limit: 1 })).entries).toEqual([first]);
  const page = await store.read({ after: 0, limit: 1 });
  await store.append({ run: 2 }, { id: "second" });
  const restarted = createOrderedLogStore(db, address);
  expect((await restarted.read({ after: page.cursor, limit: 1 })).entries.map((entry) => entry.id)).toEqual(["second"]);
  expect(await restarted.append({ run: 1 }, { id: "first" })).toEqual(first);
  await expect(restarted.append({ run: "changed" }, { id: "first" })).rejects.toThrow("identity");
});

test("an optimistic entry is not repeated when its relay occurrence arrives", async () => {
  const { store } = await fixture();
  const first = await store.append("local", { id: "first" });
  const page = await store.read({ after: 0 });
  await store.receive(
    [
      { sequence: 1, entries: [{ id: "remote", writerId: "desktop", createdAt: first.createdAt, value: "earlier" }] },
      { sequence: 2, entries: [first] },
    ],
    2,
  );
  const next = await store.read({ after: page.cursor });
  expect(next.entries.map((entry) => entry.id)).toEqual(["remote"]);
  expect((await store.read({ after: next.cursor })).entries).toEqual([]);
});

test("retention hides expired entries and keeps pending work within its own writer", async () => {
  const { db, address } = await fixture();
  let now = Date.parse("2026-11-04T00:00:00Z");
  const store = createOrderedLogStore(db, { ...address, keep: { days: 30 }, now: () => now });
  await store.append("old", { id: "old" });
  now += 31 * 86_400_000;
  const current = await store.append("new", { id: "new" });
  expect((await store.read({ newest: true, limit: 50 })).entries).toEqual([current]);
  expect((await store.pending(50)).map((item) => item.entry.id)).toEqual(["new"]);
  const other = createOrderedLogStore(db, { ...address, stream: "desktop", writerId: "desktop" });
  expect((await other.read({ after: 0 })).entries).toEqual([]);
});

test("the newest page includes optimistic appends ahead of cached canonical history", async () => {
  const { store } = await fixture();
  const createdAt = new Date().toISOString();
  await store.receive(
    Array.from({ length: 60 }, (_, index) => ({
      sequence: index + 1,
      entries: [{ id: `old-${index}`, writerId: "desktop", createdAt, value: index }],
    })),
    60,
    { from: 0 },
  );
  await store.append("just appended", { id: "latest" });
  const page = await store.read({ newest: true, limit: 10 });
  expect(page.entries.at(-1)?.id).toBe("latest");
  expect(page.entries).toHaveLength(10);
});

test("a local append batch retains distinct immutable identities and rolls back a conflicting page", async () => {
  const { store } = await fixture();
  const items = [
    { id: "first", value: { run: 1 } },
    { id: "second", value: { run: 2 } },
  ];
  const saved = await store.appendMany(items);
  expect(saved.map(({ id }) => id)).toEqual(["first", "second"]);
  expect(await store.appendMany(items)).toEqual(saved);
  expect(await store.appendMany([items[0]!, items[0]!])).toEqual([saved[0], saved[0]]);
  expect((await store.pending(10)).map(({ entry }) => entry.id)).toEqual(["first", "second"]);
  await expect(
    store.appendMany([
      { id: "rollback", value: null },
      { id: "first", value: "changed" },
    ]),
  ).rejects.toThrow("identity");
  expect((await store.read()).entries).toEqual(saved);
  const error = await store
    .appendMany([
      { id: "duplicate", value: 1 },
      { id: "duplicate", value: 2 },
    ])
    .catch((error: unknown) => error);
  expect(error).toMatchObject({ message: "Log entry identity reused with changed content" });
  expect((await store.read()).entries).toEqual(saved);
});
