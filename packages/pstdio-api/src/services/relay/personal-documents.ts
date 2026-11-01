import type { DocumentStore, StorageOwner, SyncSpace } from "pstdio-sync";
import { createDocumentRelay, createDocumentSync, fetchSyncSpaces } from "pstdio-sync/relay";
import { historyReferenceName } from "../personal-history/references";
import { documentProgress } from "./document-progress";
import type { createPersonalContext } from "./personal-context";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

/** Only the small index and shared pointers use CRDTs. Their sync objects survive access renewal. */
export const createPersonalDocuments = (input: {
  config: RelayWorkbench;
  context: ReturnType<typeof createPersonalContext>;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
  claim: (id: string) => void;
}) => {
  const { config, context } = input;
  let requestSignal = input.signal;
  let keysFor: AbortSignal | undefined;
  let spaces: Awaited<ReturnType<typeof fetchSyncSpaces>> | undefined;
  let records: ReturnType<typeof createDocumentSync> | undefined;
  let shared: ReturnType<typeof createDocumentSync> | undefined;
  let ids: string[] = [];
  const relayFor = (space: SyncSpace) => (documentId: string) => {
    input.claim(documentId);
    return createDocumentRelay({
      origin: config.relayOrigin,
      space,
      documentId,
      get signal() {
        return requestSignal;
      },
      token: async () => (await input.access()).token,
    });
  };
  const syncFor = (owner: StorageOwner, store: DocumentStore, space: SyncSpace, documentId: string) =>
    createDocumentSync({
      owner,
      store,
      space,
      documentId,
      relay: relayFor(space)(documentId),
      quarantine: createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId }),
    });
  const close = () => {
    records?.close();
    shared?.close();
  };
  return {
    relayFor,
    close,
    get space() {
      return spaces?.personal;
    },
    owns: (id: string) => ids.includes(id),
    async prepare(signal: AbortSignal) {
      requestSignal = signal;
      const renewed = keysFor !== signal;
      if (!renewed) return { personal: spaces!.personal, renewed: false, recreated: false };
      const keys = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal });
      keysFor = signal;
      const recreated =
        spaces?.personal.generation !== keys.personal.generation ||
        spaces?.project.generation !== keys.project.generation;
      if (recreated) {
        close();
        const recordsId = await keys.personal.documentId(JSON.stringify(["pstdio.personal-history", "records-v2"]));
        const sharedId = await keys.project.documentId(historyReferenceName);
        ids = [recordsId, sharedId];
        records = syncFor(context.history.owner, context.history.records, keys.personal, recordsId);
        shared = syncFor(context.references.owner, context.references.store, keys.project, sharedId);
      }
      spaces = keys;
      return { personal: keys.personal, renewed, recreated };
    },
    async status(pendingHeads = false) {
      const record = await records?.status();
      const index = record && { ...record, pending: record.pending || pendingHeads };
      return documentProgress([index, await shared?.status()], true);
    },
    async synchronize() {
      await records!.synchronize();
      await shared!.synchronize();
    },
  };
};
