import { afterEach, expect, test } from "bun:test";
import { createSyncSpace, openBlob } from "pstdio-sync/encryption";
import { createLogStreamSync } from "pstdio-sync/logs";
import type { StorageLogEntry } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { createDb } from "../../db/connection.pglite";
import { projects, storage_log_entries } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createOrderedLogs } from "./ordered-logs";
import { createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
const fixture = async (tail = false) => {
  const id = crypto.randomUUID();
  const owner = { workbenchId: id, extensionId: "example.device-logs" };
  const space = await createSyncSpace({
    projectId: id,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const relays = new Map<string, ReturnType<typeof createRelay>>();
  const device = async () => {
    const connection = await createDb({ path: ":memory:" });
    cleanup.push(connection.close);
    const now = new Date().toISOString();
    await connection.db.insert(projects).values({ id, name: "Logs", shorthand: "L", created_at: now, updated_at: now });
    const documents = createDocumentStorageDBService(connection.db);
    const logs = createOrderedLogs(connection.db, { metadata: documents.transaction, changed: () => {} });
    const payloads: string[] = [];
    logs.attach(owner, async (entry, store) => {
      const name = JSON.stringify([entry.name, entry.scope, entry.stream]);
      const remote = relays.get(name) ?? createRelay();
      relays.set(name, remote);
      return createLogStreamSync({
        space,
        documentId: await space.documentId(name),
        relay: remote.relay,
        store,
        canCompact: !tail && entry.stream === (await logs.writerId()),
        manifestBlobs: async () => {
          const blobs = await remote.relay.manifestBlobs();
          return {
            ...blobs,
            get: async (blobId, byteLength) => {
              const bytes = await blobs.get(blobId, byteLength);
              const value = JSON.parse(new TextDecoder().decode(await openBlob(space, blobId, bytes)));
              const key = value.entry?.id ?? value.id;
              if (typeof key === "string") payloads.push(key);
              return bytes;
            },
          };
        },
      });
    });
    return {
      ...connection,
      documents,
      logs,
      payloads,
      log: logs.open(owner, { name: "runs", writer: "device" }, "project"),
    };
  };
  const writers = [await device(), await device()];
  const values: StorageLogEntry[] = [];
  for (const [writer, source] of writers.entries()) {
    for (let index = 0; index < 5; index++)
      values.push(await source.log.append({ writer, index }, { id: `${writer}-${index}` }));
    await source.logs.publish(owner);
  }
  const reader = await device();
  for (const writer of writers) {
    const update = await writer.documents.transaction(owner, async ({ document }) => Y.encodeStateAsUpdate(document));
    await reader.documents.transaction(owner, async ({ document }) => Y.applyUpdate(document, update));
  }
  const ordered = values.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.writerId.localeCompare(b.writerId) || a.id.localeCompare(b.id),
  );
  return { reader, writers, ordered, owner };
};

for (const tail of [false, true])
  test(`a logical device newest page opens only displayed payloads across two ${tail ? "uncompacted" : "archived"} writers`, async () => {
    const { reader, ordered } = await fixture(tail);
    const page = await reader.log.read({ newest: true, limit: 3 });
    expect(page.entries.map((entry) => entry.id)).toEqual(ordered.slice(-3).map((entry) => entry.id));
    expect(reader.payloads.sort()).toEqual(page.entries.map((entry) => entry.id).sort());
    expect((await reader.db.select().from(storage_log_entries)).map((row) => row.entry_id).sort()).toEqual(
      page.entries.map((entry) => entry.id).sort(),
    );
    expect((await reader.log.read({ after: page.cursor, limit: 3 })).entries).toEqual([]);
    expect(reader.payloads).toHaveLength(3);
  });

for (const tail of [false, true])
  test(`logical device ${tail ? "tail" : "archive"} pagination opens only each chosen page and preserves writer positions`, async () => {
    const { reader, ordered } = await fixture(tail);
    let after: string | 0 = 0;
    const actual: string[] = [];
    for (let offset = 0; offset < ordered.length; offset += 3) {
      const before = reader.payloads.length;
      const page = await reader.log.read({ after, limit: 3 });
      expect(page.entries.map((entry) => entry.id)).toEqual(ordered.slice(offset, offset + 3).map((entry) => entry.id));
      expect(reader.payloads.length - before).toBe(page.entries.length);
      actual.push(...page.entries.map((entry) => entry.id));
      expect((await reader.db.select().from(storage_log_entries)).length).toBe(actual.length);
      expect(page.more).toBe(offset + 3 < ordered.length);
      after = page.cursor;
    }
    expect(new Set(actual).size).toBe(10);
    expect((await reader.log.read({ after, limit: 3 })).entries).toEqual([]);
  });
