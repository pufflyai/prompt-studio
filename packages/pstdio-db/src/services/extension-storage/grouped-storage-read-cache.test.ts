import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { createLegacyRecordStorage, storageRecordId } from "pstdio-sync";
import * as schema from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { openGroupedTestStorage, groupedStorageOwner as owner } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
let service: ReturnType<typeof createDocumentStorageDBService>;
let queries: string[] = [];
const target = storageRecordId(["project", "scope", "kv"], "fixed");
let historySize = 0;

beforeAll(async () => {
  const database = await openGroupedTestStorage(cleanup);
  const db = drizzle(database.pglite, { schema, logger: { logQuery: (query) => queries.push(query) } });
  service = createDocumentStorageDBService(db);
  await service
    .open({ owner })
    .records.commit({ operationId: "fixed-write", edits: [{ recordId: target, replace: { fixed: true } }] });
});
afterAll(async () => {
  for (const close of cleanup.reverse()) await close();
});

for (const count of [100])
  test(`record saves and namespace reads use bounded work after ${count} edits`, async () => {
    const records = service.open({ owner }).records;
    for (let index = historySize; index < count; index++)
      await records.commit({
        operationId: `edit-${index}`,
        edits: [{ recordId: "changing", replace: index }],
      });
    historySize = count;
    const legacy = createLegacyRecordStorage({ store: service, owner }).scope("project", "scope");
    queries = [];
    const start = performance.now();
    for (let repeat = 0; repeat < 20; repeat++) {
      await records.commit({
        operationId: `sample-${count}-${repeat}`,
        edits: [{ recordId: "changing", replace: repeat }],
      });
      expect(await legacy.kv.get("fixed")).toEqual({ fixed: true });
      expect(await legacy.kv.list()).toHaveLength(1);
    }
    console.info(
      JSON.stringify({ priorEdits: count, samples: 20, saveAndReadMilliseconds: (performance.now() - start) / 20 }),
    );
    expect(queries.filter((query) => query.includes('from "extension_storage_journal"'))).toHaveLength(0);
    expect(queries.filter((query) => query.includes('from "storage_document_updates"'))).toHaveLength(0);
  });
