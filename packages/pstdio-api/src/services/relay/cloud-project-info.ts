import { createMemoryDocumentStore } from "pstdio-sync";
import { coreOwnerId, projectInfoDocumentId, projectInfoState, readProjectInfo } from "pstdio-sync/records";
import { createDocumentRelay, createDocumentSync, createRelayAccess, fetchSyncSpaces } from "pstdio-sync/relay";
import type { RelayWorkbench } from "./runtime";

/**
 * Reads a cloud project's info straight from the relay. A new device needs the name before the
 * project exists locally, and local document storage belongs to an existing project.
 */
export const readCloudProjectInfo = async (config: RelayWorkbench, signal: AbortSignal) => {
  const owner = { workbenchId: config.workbenchId, extensionId: coreOwnerId };
  const access = await createRelayAccess({ ...config, signal })();
  const remaining = Math.max(0, Date.parse(access.expiresAt) - Date.now());
  const attempt = AbortSignal.any([signal, AbortSignal.timeout(remaining)]);
  const { project: space } = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal: attempt });
  const documentId = await space.documentId(JSON.stringify([coreOwnerId, projectInfoDocumentId]));
  const store = createMemoryDocumentStore();
  const sync = createDocumentSync({
    owner,
    space,
    documentId,
    store,
    relay: createDocumentRelay({
      origin: config.relayOrigin,
      space,
      documentId,
      signal: attempt,
      token: async () => access.token,
    }),
    // Nothing is kept from this read. The project's own sync quarantines bad envelopes once it exists.
    quarantine: async () => {},
  });
  try {
    const document = await sync.download();
    try {
      return { info: readProjectInfo(document), state: projectInfoState(document) };
    } finally {
      document.destroy();
    }
  } finally {
    sync.close();
  }
};
