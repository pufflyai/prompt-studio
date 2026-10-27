import type { SyncSpace } from "pstdio-sync";
import { coreOwnerId, createMemoryDocumentStore, resourceNumbersDocumentId, type StorageOwner } from "pstdio-sync";
import { createDocumentSync, createRecordStreamSync, type DocumentRelay, type SyncFailure } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

/** A new stream first imports the old relay source, including when every older device is offline. */
export const createResourceNumberSync = async (input: {
  owner: StorageOwner;
  space: SyncSpace;
  service: ExtensionsRouteDeps["extensionResourceSequencesService"];
  relay: (documentId: string) => DocumentRelay;
  quarantine: (documentId: string) => (failure: SyncFailure) => Promise<void>;
}) => {
  const store = input.service.recordStream(input.owner.workbenchId);
  const documentId = await input.space.documentId(JSON.stringify([coreOwnerId, "record-stream"]));
  const relay = input.relay(documentId);
  const cursor = await store.open();
  if (!cursor.joined) {
    const remote = await relay.read(0);
    if (!remote.state && remote.lastSequence === 0) {
      const legacyId = await input.space.documentId(JSON.stringify([coreOwnerId, resourceNumbersDocumentId]));
      const legacy = createDocumentSync({
        owner: input.owner,
        space: input.space,
        documentId: legacyId,
        relay: input.relay(legacyId),
        store: createMemoryDocumentStore(),
        quarantine: input.quarantine(legacyId),
      });
      try {
        const document = await legacy.download();
        try {
          await input.service.importLegacy(input.owner.workbenchId, document);
        } finally {
          document.destroy();
        }
      } finally {
        legacy.close();
      }
    }
  }
  return createRecordStreamSync({
    space: input.space,
    documentId,
    store,
    relay,
    quarantine: input.quarantine(documentId),
  });
};
