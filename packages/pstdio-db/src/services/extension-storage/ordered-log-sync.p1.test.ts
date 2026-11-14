import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLogStreamSync } from "pstdio-sync/logs";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createOrderedLogStore } from "./ordered-log-store";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
const peers = async (options: { keep?: { days: number }; now?: () => number } = {}) => {
  const id = crypto.randomUUID();
  const space = await createSyncSpace({
    projectId: id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId("project log");
  const f = createRelay();
  const peer = async (writerId: string) => {
    const { db, close } = await createDb({ path: ":memory:" });
    cleanup.push(close);
    const now = new Date().toISOString();
    await db.insert(projects).values({ id, name: "Log", shorthand: "L", created_at: now, updated_at: now });
    const store = createOrderedLogStore(db, {
      owner: { workbenchId: id, extensionId: "example.logs" },
      name: "runs",
      scope: "project",
      stream: "project",
      writerId,
      ...options,
    });
    const start = (relay: Parameters<typeof createLogStreamSync>[0]["relay"] = f.relay, canCompact = true) =>
      createLogStreamSync({ space, documentId, relay, store, canCompact });
    return { store, sync: start(), start };
  };
  return { first: await peer("laptop"), second: await peer("desktop"), peer, f };
};

test("project logs apply relay order and settle optimistic appends", async () => {
  const { first, second, f } = await peers();
  await first.store.append("first", { id: "first" });
  await second.store.append("second", { id: "second" });
  await first.sync.publish();
  await second.sync.publish();
  const firstPage = await first.sync.read({ after: 0, limit: 50 });
  const secondPage = await second.sync.read({ after: 0, limit: 50 });
  expect(firstPage.entries.map((entry) => entry.id)).toEqual(["first", "second"]);
  expect(secondPage.entries).toEqual(firstPage.entries);
  expect(await first.store.pending(50)).toEqual([]);
  expect(f.updates()).toHaveLength(2);
});

test("a restarted publisher reuses the durable encrypted envelope after a lost acknowledgement", async () => {
  const { first, second, f } = await peers();
  let lose = true;
  const relay = {
    ...f.relay,
    update: async (envelope: Parameters<typeof f.relay.update>[0]) => {
      const previous = f.updates().find((entry) => entry.updateId === envelope.updateId);
      if (previous) return { sequence: previous.sequence, duplicate: true };
      const result = await f.relay.update(envelope);
      if (lose) {
        lose = false;
        throw new Error("ACK lost");
      }
      return result;
    },
  };
  await first.store.append("saved before network", { id: "uncertain" });
  await expect(first.start(relay).publish()).rejects.toThrow("ACK lost");
  const [pending] = await first.store.pending(100);
  expect(pending?.delivery?.envelope.updateId).toBe(f.updates()[0]!.updateId);
  await first.start(relay).publish();
  expect(f.updates()).toHaveLength(1);
  expect((await second.sync.read({ after: 0 })).entries.map((entry) => entry.id)).toEqual(["uncertain"]);
});

test("a full writer refounds lost relay history before new appends enter the new order", async () => {
  const { first, peer, f } = await peers();
  await first.store.append("saved history", { id: "saved" });
  await first.sync.publish();
  f.lose();
  await first.sync.read({ after: 0 });
  await first.store.append("after loss", { id: "later" });
  await first.sync.publish();
  const third = await peer("new-device");
  expect((await third.sync.read({ after: 0 })).entries.map((entry) => entry.id)).toEqual(["saved", "later"]);
});

test("lazy log reads report remaining remote pages without claiming unseen payloads were downloaded", async () => {
  const { first, second } = await peers();
  for (let index = 0; index < 25; index++) await first.store.append(index, { id: `page-${index}` });
  await first.sync.publish();
  await first.sync.compact();
  const page = await second.sync.read({ after: 0, limit: 10 });
  expect(page.more).toBe(true);
  expect(await second.store.snapshotPage({ sequence: 0, index: 0 }, 100)).toHaveLength(10);
  const next = await second.sync.read({ after: page.cursor, limit: 10 });
  expect(next.entries.map((entry) => entry.id)).toEqual(Array.from({ length: 10 }, (_, index) => `page-${index + 10}`));
  expect(next.more).toBe(true);
  const last = await second.sync.read({ after: next.cursor, limit: 10 });
  expect(last.entries.map((entry) => entry.id)).toEqual(Array.from({ length: 5 }, (_, index) => `page-${index + 20}`));
  expect(last.more).toBe(false);
  expect(await second.sync.compact()).toBe(true);
});

test("a full log writer keeps an indexed latest state as it appends", async () => {
  const { first, f } = await peers();
  await first.store.append("one", { id: "one" });
  await first.sync.publish();
  expect(f.latest()).not.toBeNull();
  const before = f.latest()!.stateId;
  await first.store.append("two", { id: "two" });
  await first.sync.publish();
  expect(f.latest()!.stateId).not.toBe(before);
  expect(f.latest()!.through).toBe(2);
});

test("a device log's full reader cannot publish or refound its writer's snapshot", async () => {
  const { first, second, f } = await peers();
  await first.store.append("writer history", { id: "writer-history" });
  await first.sync.publish();
  const reader = second.start(f.relay, false);
  expect((await reader.read()).entries.map((entry) => entry.id)).toEqual(["writer-history"]);
  const before = f.latest()!.stateId;
  expect(await reader.compact()).toBe(false);
  expect(f.latest()!.stateId).toBe(before);
  f.lose();
  await expect(reader.read()).rejects.toThrow("writer");
  expect(f.latest()).toBeNull();
  await first.sync.read();
  expect(f.latest()).not.toBeNull();
});

test("a blob-backed log entry may exceed the record author-group limit", async () => {
  const { first, second, f } = await peers();
  const value = { output: "large private session output\n".repeat(160_000) };
  expect(Buffer.byteLength(JSON.stringify(value))).toBeGreaterThan(4 * 1024 * 1024);
  await first.store.append(value, { id: "large-history" });
  await first.sync.publish();
  expect((await second.sync.read({ limit: 1 })).entries[0]?.value).toEqual(value);
  expect(f.updates()[0]!.payload.length).toBeLessThan(1000);
});

test("a missing ordered tail update blocks a log read instead of claiming completion", async () => {
  const { first, second, peer, f } = await peers();
  await first.store.append("base", { id: "base" });
  await first.sync.publish();
  await second.store.append("tail", { id: "tail" });
  await second.sync.publish();
  const third = await peer("reader");
  const broken = third.start({
    ...f.relay,
    read: async (after) => {
      const result = await f.relay.read(after);
      return after >= 1 && result.status === "updates" ? { ...result, updates: [] } : result;
    },
  });
  await expect(broken.read({ after: 0 })).rejects.toThrow("missing");
});
