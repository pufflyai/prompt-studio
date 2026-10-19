import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { createLegacyRecordStorage, type JournalEntry, storageRecordId } from "pstdio-sync";
import { fingerprint } from "pstdio-sync-contracts";
import * as schema from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";
import { openGroupedTestStorage, groupedStorageOwner as owner } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
let service: ReturnType<typeof createGroupedStorageDBService>;
let queries: string[] = [];
const environmentId = "environment-a";
const target = storageRecordId(["project", "scope", "kv"], "fixed");
const collectionTarget = storageRecordId(["project", "scope", "collection", "items"], "fixed");
let historySize = 0;

beforeAll(async () => {
  const database = await openGroupedTestStorage(cleanup);
  const db = drizzle(database.pglite, { schema, logger: { logQuery: (query) => queries.push(query) } });
  service = createGroupedStorageDBService(db);
  const records = service.open({ owner, environmentId }).records;
  await records.commit({
    operationId: "fixed-write",
    edits: [
      { recordId: target, expectedRevision: (await records.read(target)).revision, replace: { fixed: true } },
      {
        recordId: collectionTarget,
        expectedRevision: (await records.read(collectionTarget)).revision,
        replace: { value: { fixed: true }, sortOrder: 1 },
      },
    ],
  });
});
afterAll(async () => {
  for (const close of cleanup.reverse()) await close();
});

for (const count of [100, 1_000, 10_000, 30_000]) {
  test(`repeated record and legacy reads skip retained history after ${count} unrelated operations`, async () => {
    const expected = await fingerprint(null);
    await service.transaction(owner, async (state) => {
      for (let index = historySize; index < count; index++) {
        const entry: JournalEntry = {
          inputFingerprint: `unrelated-${index}`,
          mutation: {
            operationId: `unrelated-${index}`,
            environmentId,
            parents: [],
            changes: [
              {
                recordId: `unrelated-${index}`,
                expectedRevision: 0,
                baseDeleted: false,
                value: { expected, next: index },
              },
            ],
          },
        };
        state.journal.push(entry);
      }
    });
    historySize = count;
    const records = service.open({ owner, environmentId }).records;
    const legacy = createLegacyRecordStorage({ store: service, owner, environmentId }).scope("project", "scope");
    queries = [];
    const start = performance.now();
    for (let repeat = 0; repeat < 5; repeat++) {
      expect((await records.read(target)).value).toEqual({ fixed: true });
      expect(await legacy.kv.get("fixed")).toEqual({ fixed: true });
      expect(await legacy.collection("items").get("fixed")).toEqual({
        id: "fixed",
        value: { fixed: true },
        sortOrder: 1,
      });
    }
    console.info(JSON.stringify({ unrelatedOperations: count, reads: 15, milliseconds: performance.now() - start }));
    expect(queries.filter((query) => query.includes('from "extension_storage_journal"'))).toHaveLength(0);
    expect(queries.filter((query) => query.includes("for update"))).toHaveLength(0);
  });
}
