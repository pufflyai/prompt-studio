import type { DocumentStore, StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import { createDocumentRelay, createDocumentSync, fetchSyncSpaces, type SubscribeDocument } from "pstdio-sync/relay";
import { historyReferenceName } from "../personal-history/references";
import { documentProgress } from "./document-progress";
import { createRelayLogs } from "./logs";
import type { createPersonalContext } from "./personal-context";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

/** Only the small index and shared pointers use CRDTs. Their sync objects survive access renewal. */
export const createPersonalDocuments = (input: {
  config: RelayWorkbench;
  context: ReturnType<typeof createPersonalContext>;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
  subscribe: SubscribeDocument;
}) => {
  const { config, context } = input;
  let requestSignal = input.signal;
  let keysFor: AbortSignal | undefined;
  let keyRevision = 0;
  let preparedRevision = -1;
  let spaces: Awaited<ReturnType<typeof fetchSyncSpaces>> | undefined;
  let records: ReturnType<typeof createDocumentSync> | undefined;
  let shared: ReturnType<typeof createDocumentSync> | undefined;
  let logs: ReturnType<typeof createRelayLogs> | undefined;
  let ids: string[] = [];
  const relayFor = (space: SyncSpace, subscribe?: SubscribeDocument) => (documentId: string) => {
    return createDocumentRelay({
      subscribe,
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
      relay: relayFor(space, input.subscribe)(documentId),
      quarantine: createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId }),
    });
  const close = () => {
    records?.close();
    shared?.close();
    void logs?.close();
  };
  return {
    relayFor,
    close,
    invalidateKeys() {
      keyRevision++;
    },
    get space() {
      return preparedRevision === keyRevision ? spaces?.personal : undefined;
    },
    owns: (id: string) => ids.includes(id) || Boolean(logs?.has(id)),
    async prepare(signal: AbortSignal) {
      requestSignal = signal;
      const renewed = keysFor !== signal;
      const revision = keyRevision;
      if (!renewed && preparedRevision === revision)
        return { personal: spaces!.personal, renewed: false, recreated: false };
      const keys = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal });
      keysFor = signal;
      const recreated =
        spaces?.personal.generation !== keys.personal.generation ||
        spaces?.project.generation !== keys.project.generation;
      if (recreated) {
        close();
        const recordsId = await keys.personal.documentId(JSON.stringify(["pstdio.personal-history", "records-v3"]));
        const sharedId = await keys.project.documentId(historyReferenceName);
        ids = [recordsId, sharedId];
        records = syncFor(context.history.owner, context.history.records, keys.personal, recordsId);
        shared = syncFor(context.references.owner, context.references.store, keys.project, sharedId);
        logs = createRelayLogs({
          owner: context.history.owner,
          space: keys.personal,
          service: context.logs,
          relay: relayFor(keys.personal),
          signal: input.signal,
          subscribe: input.subscribe,
        });
      }
      spaces = keys;
      preparedRevision = revision;
      return { personal: keys.personal, renewed, recreated };
    },
    async status(pendingHeads = false) {
      const record = await records?.status();
      const index = record && { ...record, pending: record.pending || pendingHeads };
      return documentProgress([index, await shared?.status(), await logs?.status()], true);
    },
    async synchronize() {
      await logs!.publish();
      await records!.synchronize();
      await context.history.synchronize();
      await shared!.synchronize();
    },
  };
};
