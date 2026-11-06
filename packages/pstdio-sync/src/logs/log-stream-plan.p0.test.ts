import { expect, test } from "bun:test";
import { fingerprint, type Json, type ReadResult, type StorageLogEntry } from "pstdio-sync-contracts";
import { decodeLogCursor } from "./log-cursor";
import { planLogStream } from "./log-stream-plan";
import type { LogStreamStore } from "./log-types";
import { createMemoryLogStore } from "./memory-log-store";

const createdAt = "2026-11-04T12:00:00.000Z";
const entries: StorageLogEntry[] = ["first", "second"].map((id) => ({ id, writerId: "peer", createdAt, value: id }));
const empty: ReadResult = { status: "updates", updates: [], lastSequence: 0, more: false, state: null };
const latest: ReadResult = {
  ...empty,
  lastSequence: 1,
  updates: [{ sequence: 1, updateId: "update-identity-1", deviceId: "peer", payload: "", createdAt }],
};
const plan = async (store: LogStreamStore, first: ReadResult, options: Parameters<typeof planLogStream>[4]) => {
  const headers = await Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      fingerprint: await fingerprint(entry as unknown as Json),
      reference: { blobId: "payload-identity-1", byteLength: 1 },
    })),
  );
  // This planner test supplies already authenticated metadata, without opening payloads or crypto.
  return planLogStream(
    { store, relay: { read: async () => first } } as unknown as Parameters<typeof planLogStream>[0],
    {
      wireUpdate: async () => headers,
      retained: (rows: typeof headers) => rows.map((row, index) => ({ ...row, index })),
    } as unknown as Parameters<typeof planLogStream>[1],
    first,
    { root: null, offset: 0 },
    options,
  );
};

for (const newest of [true, false])
  test(`a ${newest ? "newest" : "ascending"} plan fences cache ACKs newer than its captured relay head`, async () => {
    const { store } = createMemoryLogStore({ address: "race", writerId: "writer" });
    await store.receive([{ sequence: 1, entries: [entries[0]!], retainedCount: 2 }], 1, { from: -1 });
    const before = await plan(store, empty, { newest, limit: 2 });
    expect(before.entries).toEqual([]);
    expect(decodeLogCursor(store.address, before.cursor).relay).toBe(0);
    expect(before.more).toBe(!newest);
    const after = await plan(store, latest, { after: before.cursor, limit: 2 });
    expect(after.entries.map((entry) => entry.id)).toEqual(["first", "second"]);
  });

test("a pending entry ACKed between metadata snapshots stays visible once without consuming its unseen batch siblings", async () => {
  const { store } = createMemoryLogStore({ address: "race", writerId: "peer", now: () => Date.parse(createdAt) });
  await store.append("first", { id: "first" });
  const localPlan = store.plan!;
  const raced = {
    ...store,
    async plan(options: Parameters<typeof localPlan>[0]) {
      const selected = await localPlan(options);
      await store.receive([{ sequence: 1, entries: [entries[0]!], retainedCount: 2 }], 1, { from: -1 });
      return selected;
    },
  };
  const before = await plan(raced, empty, { limit: 2 });
  expect(before.entries.map((entry) => entry.id)).toEqual(["first"]);
  expect(decodeLogCursor(store.address, before.cursor)).toMatchObject({ relay: 0, local: 1 });
  const after = await plan(store, latest, { after: before.cursor, limit: 2 });
  expect(after.entries.map((entry) => entry.id)).toEqual(["second"]);
});
