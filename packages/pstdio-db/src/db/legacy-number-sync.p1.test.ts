import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { coreOwnerId, rememberResourceNumber, resourceNumbers, resourceNumbersDocumentId } from "pstdio-sync/records";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { createExtensionResourceSequencesDBService } from "../services/extension-resource-sequences";
import { createDocumentStorageDBService } from "../services/extension-storage/document-storage";
import { createRelay } from "../services/extension-storage/record-stream-relay.fixture";
import { createProjectsDBService } from "../services/projects/projects";
import { createDb } from "./connection.pglite";

test("a refused newer pending creation cannot remove the independently migrated old allocation floor", async () => {
  const root = await mkdtemp(join(tmpdir(), "legacy-number-sync-"));
  let first: Awaited<ReturnType<typeof createDb>> | undefined;
  let second: Awaited<ReturnType<typeof createDb>> | undefined;
  let documents: ReturnType<typeof createDocumentStorageDBService> | undefined;
  let peerDocuments: ReturnType<typeof createDocumentStorageDBService> | undefined;
  try {
    first = await createDb({ path: join(root, "database") });
    second = await createDb({ path: ":memory:" });
    const project = await createProjectsDBService(first.db).create({ name: "Migrated history" });
    await createProjectsDBService(second.db).create({ id: project.id, name: project.name });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: null,
      keys: [{ generation: 1, secret: "A".repeat(43) }],
    });
    const { relay } = createRelay();
    const documentId = await space.documentId(JSON.stringify([coreOwnerId, "record-stream"]));
    const start = (storage: ReturnType<typeof createDocumentStorageDBService>) =>
      createRecordStreamSync({
        space,
        documentId,
        relay,
        store: storage.documents.recordStream(owner),
        quarantine: async (error) => {
          throw error;
        },
      });
    documents = createDocumentStorageDBService(first.db);
    peerDocuments = createDocumentStorageDBService(second.db);
    let sync = start(documents);
    const peer = start(peerDocuments);
    await documents
      .open({ owner })
      .records.commit({ operationId: "base", edits: [{ recordId: "base", replace: true }] });
    await sync.synchronize();
    await peer.synchronize();
    const resource = { id: "claim", extensionId: "example.items", kind: "item", prefix: "IT", value: 20, aliases: [] };
    const records = documents.open({ owner }).records;
    const absent = await records.read(resource.id);
    await records.commit({
      operationId: "new-pending-create",
      edits: [{ recordId: resource.id, expectedRevision: absent.revision, replace: resource }],
    });
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
      resourceNumbers(document).set(resource.id, { ...resource, value: 7 });
      rememberResourceNumber(document, { ...resource, value: 700 });
    });
    await peerDocuments.open({ owner }).records.commit({
      operationId: "cloud-winner",
      edits: [{ recordId: resource.id, replace: { ...resource, value: 9 } }],
    });
    await peer.synchronize();
    await documents.flushStatistics();
    await first.close();
    first = await createDb({ path: join(root, "database") });
    documents = createDocumentStorageDBService(first.db);
    sync = start(documents);
    await sync.synchronize();
    await peer.synchronize();
    expect((await documents.open({ owner }).records.outcome("new-pending-create"))?.state).toBe("refused");
    const input = {
      projectId: project.id,
      extensionId: resource.extensionId,
      kind: resource.kind,
      prefix: resource.prefix,
    };
    const numbers = createExtensionResourceSequencesDBService(second.db, peerDocuments);
    expect((await numbers.identity({ ...input, id: resource.id }))?.shorthand).toBe("IT-9");
    expect((await numbers.allocate(input)).shorthand).toBe("IT-701");
  } finally {
    await documents?.flushStatistics();
    await peerDocuments?.flushStatistics();
    await first?.close();
    await second?.close();
    await rm(root, { recursive: true, force: true });
  }
});
