import { strict as assert } from "node:assert";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { createSyncSpace, sealUpdate } from "pstdio-sync/encryption";
import { editResourceDocument } from "pstdio-sync/records";
import { createRecordStreamSync, encodeRecordFrame } from "pstdio-sync/relay";
import { completeBenchmarkWorker, measure, runBenchmarkCase } from "storage-scale-fixture";
import { createDb } from "../db/connection.pglite";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createRelay } from "./extension-storage/record-stream-relay.fixture";
import { createProjectsDBService } from "./projects/projects";

const count = 100_000;
const extensionId = "scale.numbers";
const emit = (phase: string, data: object) => console.log(JSON.stringify({ phase, count, ...data }));
const prepare = async (root: string) => {
  await mkdir(root);
  const connection = await createDb({ path: join(root, "source") });
  const documents = createDocumentStorageDBService(connection.db);
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Number scale" });
    const records = documents.open({ owner: { workbenchId: project.id, extensionId: "pstdio" } }).records;
    for (let offset = 0; offset < count; offset += 1_000) {
      await records.commit({
        operationId: `seed-${offset}`,
        edits: Array.from({ length: 1_000 }, (_, index) => {
          const value = offset + index + 1;
          const id = `item-${String(value).padStart(6, "0")}`;
          return { recordId: id, replace: { id, extensionId, kind: "item", prefix: "IT", value, aliases: [] } };
        }),
      });
      emit("fixture-progress", { records: offset + 1_000, acceptedTiming: false });
    }
    await documents.flushStatistics();
    const result = await connection.db.execute<{ records: number }>(
      sql`SELECT count(*)::int AS records FROM storage_resource_identities WHERE workbench_id = ${project.id}`,
    );
    assert.equal(result.rows[0]!.records, count);
    await writeFile(join(root, "fixture.json"), JSON.stringify({ projectId: project.id, count }));
  } finally {
    await documents.flushStatistics();
    await connection.close();
  }
};

const sample = async (root: string) => {
  const metadata = JSON.parse(await readFile(join(root, "fixture.json"), "utf8")) as {
    projectId: string;
    count: number;
  };
  assert.equal(metadata.count, count);
  const source = await createDb({ path: join(root, "source") });
  const diagnostics: { phase: string; records?: number }[] = [];
  const documents = createDocumentStorageDBService(source.db, undefined, (event) => diagnostics.push(event));
  const numbers = createExtensionResourceSequencesDBService(source.db, documents);
  let target: Awaited<ReturnType<typeof createDb>> | undefined;
  let targetDocuments: ReturnType<typeof createDocumentStorageDBService> | undefined;
  try {
    // No source records are read before this cold allocation.
    const allocated = await measure(() =>
      numbers.allocate({ projectId: metadata.projectId, extensionId, kind: "item", prefix: "IT" }),
    );
    assert.equal(allocated.value.shorthand, "IT-100001");
    assert(!diagnostics.some((event) => event.phase === "document-loaded"));
    emit("cold-allocation", { ...allocated, value: allocated.value, diagnostics });
    const owner = { workbenchId: metadata.projectId, extensionId: "pstdio" };
    const store = numbers.recordStream(metadata.projectId);
    const cursor = await store.open();
    await store.sent(Number.MAX_SAFE_INTEGER);
    const one = await numbers.allocate({ projectId: metadata.projectId, extensionId, kind: "item", prefix: "IT" });
    const outbox = await store.outbox(1_048_576);
    assert.equal(outbox.length, 1);
    assert.deepEqual(
      outbox[0]!.records.map((record) => record.recordId),
      [one.id],
    );
    assert(outbox[0]!.records[0]!.bytes.length < 4_096);
    emit("incremental-upload", { records: 1, bytes: outbox[0]!.records[0]!.bytes.length, cursor });

    const space = await createSyncSpace({
      projectId: owner.workbenchId,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
    const relay = createRelay();
    const sync = createRecordStreamSync({
      space,
      documentId,
      relay: relay.relay,
      store,
      quarantine: async (failure) => {
        throw new Error(JSON.stringify(failure));
      },
    });
    const published = await measure(() => sync.synchronize());
    emit("publish-latest-state", { ...published, value: undefined, requests: { ...relay.requests } });

    // This new offline identity collides with the first key of the large founding state. A join
    // merges the state and tail together, exercising keys repeated across SQL JSON batches.
    const collisionId = "zz-cross-batch";
    const collision = await editResourceDocument(
      [],
      {
        recordId: collisionId,
        replace: {
          id: collisionId,
          extensionId,
          kind: "item",
          prefix: "IT",
          value: 1,
          aliases: [],
        },
      },
      true,
    );
    await relay.relay.update(
      await sealUpdate(
        space,
        documentId,
        encodeRecordFrame({ records: [{ recordId: collisionId, bytes: collision.update! }], assets: [] }),
        [],
      ),
    );

    target = await createDb({ path: join(root, "target") });
    await createProjectsDBService(target.db).create({ id: metadata.projectId, name: "Downloaded numbers" });
    targetDocuments = createDocumentStorageDBService(target.db);
    const targetNumbers = createExtensionResourceSequencesDBService(target.db, targetDocuments);
    const before = { ...relay.requests };
    const download = createRecordStreamSync({
      space,
      documentId,
      relay: relay.relay,
      store: targetNumbers.recordStream(metadata.projectId),
      quarantine: async (failure) => {
        throw new Error(JSON.stringify(failure));
      },
    });
    const downloaded = await measure(() => download.synchronize());
    const requests = { reads: relay.requests.reads - before.reads, blobs: relay.requests.blobs - before.blobs };
    assert(requests.reads + requests.blobs < 1_000);
    const result = await target.db.execute<{ records: number }>(
      sql`SELECT count(*)::int AS records FROM storage_resource_identities WHERE workbench_id = ${owner.workbenchId}`,
    );
    assert.equal(result.rows[0]!.records, count + 3);
    assert.deepEqual(
      await targetNumbers.identity({ projectId: metadata.projectId, extensionId, kind: "item", id: collisionId }),
      {
        id: collisionId,
        kind: "item",
        shorthand: "IT-100003",
        aliases: ["IT-1"],
      },
    );
    assert((await download.status()).downloaded);
    emit("new-device-download", { ...downloaded, value: undefined, requests, records: result.rows[0]!.records });
  } finally {
    await documents.flushStatistics();
    await targetDocuments?.flushStatistics();
    await target?.close();
    await source.close();
  }
};

if (import.meta.main) {
  const [phase, path] = process.argv.slice(2);
  if (!path || !["prepare", "sample"].includes(phase)) throw new Error("Use prepare|sample <owned-directory>");
  const root = resolve(path);
  if (phase === "prepare") await prepare(root);
  else if (process.env.PSTDIO_SCALE_SUPERVISOR_PID === String(process.ppid))
    await completeBenchmarkWorker(() => sample(root));
  else {
    const result = await runBenchmarkCase({
      name: "resource-numbers-100000",
      command: process.execPath,
      args: [import.meta.path, "sample", root],
      emit: (event) => emit("case", event),
    });
    if (!result.complete) process.exitCode = 1;
  }
}
