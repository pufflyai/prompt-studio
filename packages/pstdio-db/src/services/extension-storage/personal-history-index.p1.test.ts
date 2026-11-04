import { afterEach, expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createPersonalHistoryIndex } from "./personal-history-index";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
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
