/** PS-1016 feature qualification: one append and newest-page read at 10 and 100,000 entries. */
import assert from "node:assert/strict";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createLogStreamSync } from "pstdio-sync/logs";
import { fingerprint, type Json, type StateInfo, type StorageLogEntry } from "pstdio-sync-contracts";
import { createDb } from "../../db/connection.pglite";
import { storage_log_entries as entries, projects, storage_log_streams as streams } from "../../db/schemas.pg";
import { encodeLogValue, logAddress } from "./ordered-log-sql";
import { createOrderedLogStore } from "./ordered-log-store";
import { createRelay } from "./record-stream-relay.fixture";

const qualify = async (count: number) => {
  const source = await createDb({ path: ":memory:" });
  const destination = await createDb({ path: ":memory:" });
  const id = crypto.randomUUID();
  try {
    const now = new Date().toISOString();
    for (const connection of [source, destination])
      await connection.db
        .insert(projects)
        .values({ id, name: "Log scale", shorthand: "L", created_at: now, updated_at: now });
    const address = {
      owner: { workbenchId: id, extensionId: "scale.logs" },
      name: "runs",
      scope: "project",
      stream: "project",
      writerId: "laptop",
    };
    const head = Math.ceil(count / 100);
    await source.db.insert(streams).values({ ...logAddress(address), head, complete_through: head });
    // Fixture setup supplies a full retained canonical copy; the production loss/founding path builds its archive.
    for (let offset = 0; offset < count; offset += 1000) {
      const rows = await Promise.all(
        Array.from({ length: Math.min(1000, count - offset) }, async (_, index) => {
          const number = offset + index;
          const entry: StorageLogEntry = {
            id: `history-${number}`,
            writerId: "laptop",
            createdAt: now,
            value: { run: number, output: "x".repeat(64) },
          };
          return {
            ...logAddress(address),
            entry_id: entry.id,
            writer_id: entry.writerId,
            created_at: Date.parse(now),
            fingerprint: await fingerprint(entry as unknown as Json),
            entry: encodeLogValue(entry),
            local: false,
            relay_sequence: Math.floor(number / 100) + 1,
            relay_index: number % 100,
          };
        }),
      );
      await source.db.insert(entries).values(rows);
    }
    const space = await createSyncSpace({
      projectId: id,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const documentId = await space.documentId("scale run log");
    const fixture = createRelay();
    const counters = {
      reads: 0,
      states: 0,
      updates: 0,
      replaces: 0,
      gets: 0,
      puts: 0,
      downloadedBytes: 0,
      uploadedBytes: 0,
    };
    const remote = fixture.relay;
    const relay = {
      ...remote,
      async read(after: number) {
        counters.reads++;
        const result = await remote.read(after);
        counters.downloadedBytes += Buffer.byteLength(JSON.stringify(result));
        return result;
      },
      async state(_info: StateInfo) {
        counters.states++;
        const value = await remote.state();
        counters.downloadedBytes += value.byteLength;
        return value;
      },
      async update(value: Parameters<typeof remote.update>[0]) {
        counters.updates++;
        counters.uploadedBytes += Buffer.byteLength(JSON.stringify(value));
        return remote.update(value);
      },
      async replace(value: Parameters<typeof remote.replace>[0]) {
        counters.replaces++;
        counters.uploadedBytes += Buffer.byteLength(JSON.stringify(value));
        return remote.replace(value);
      },
      async manifestBlobs() {
        const blobs = await remote.manifestBlobs();
        return {
          async put(id: string, bytes: Uint8Array, children: string[]) {
            counters.puts++;
            counters.uploadedBytes += bytes.byteLength;
            return blobs.put(id, bytes, children);
          },
          async get(id: string, length: number) {
            counters.gets++;
            const bytes = await blobs.get(id, length);
            counters.downloadedBytes += bytes.byteLength;
            return bytes;
          },
        };
      },
    };
    const store = createOrderedLogStore(source.db, address);
    const sync = createLogStreamSync({ space, documentId, store, relay });
    await sync.read({ newest: true, limit: 1 });
    fixture.trim();
    const snapshot = () => structuredClone(counters);
    const difference = (before: typeof counters) =>
      Object.fromEntries(
        Object.entries(counters).map(([key, value]) => [key, value - before[key as keyof typeof counters]]),
      );
    let before = snapshot();
    let started = performance.now();
    await store.append({ run: count, output: "measured append" }, { id: "measured" });
    await sync.publish();
    const append = { ms: performance.now() - started, ...difference(before) };
    fixture.trim();
    const reader = createOrderedLogStore(destination.db, { ...address, writerId: "new-device" });
    const download = createLogStreamSync({ space, documentId, store: reader, relay });
    before = snapshot();
    started = performance.now();
    const page = await download.read({ newest: true, limit: 10 });
    const newest = { ms: performance.now() - started, ...difference(before) };
    assert.equal(page.entries.length, 10);
    assert.equal(page.entries.at(-1)?.id, "measured");
    assert.equal((await reader.snapshotPage({ sequence: 0, index: 0 }, 1000)).length, 10);
    assert.ok(
      counters.gets - before.gets <= 14,
      "Newest page must download at most its ten payloads plus bounded tree nodes",
    );
    assert.equal((append as Record<string, number>).updates, 1);
    assert.ok(
      (append as Record<string, number>).puts! <= 6,
      "An append must upload only its payload and bounded COW path",
    );
    return {
      historyEntries: count,
      setup: "Bulk fixture canonical rows, production full-copy founding and compaction",
      append,
      newest,
    };
  } finally {
    await source.close();
    await destination.close();
  }
};

for (const count of [10, 100_000]) {
  process.stdout.write(`${JSON.stringify({ phase: "start", historyEntries: count })}\n`);
  process.stdout.write(`${JSON.stringify(await qualify(count))}\n`);
}
