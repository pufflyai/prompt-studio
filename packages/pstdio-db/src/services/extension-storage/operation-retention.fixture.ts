import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createRelay } from "./record-stream-relay.fixture";

export const createOperationRetentionFixture = async (path = ":memory:") => {
  const f = await createExtensionStorageFixture(path);
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const service = createDocumentStorageDBService(f.db);
  const records = service.open({ owner }).records;
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));
  const { relay } = createRelay();
  const sync = createRecordStreamSync({
    space,
    documentId,
    relay,
    store: service.documents.recordStream(owner),
    limits: { bytes: Number.MAX_SAFE_INTEGER, updates: 0 },
    quarantine: async (error) => {
      throw new Error(JSON.stringify(error));
    },
  });
  return {
    ...f,
    owner,
    relay,
    service,
    records,
    sync,
    close: async () => {
      await service.flushStatistics();
      await f.svc.flushStatistics();
      await f.close();
    },
  };
};
