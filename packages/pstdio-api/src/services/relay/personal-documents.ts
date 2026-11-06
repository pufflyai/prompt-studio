import type { DocumentStore, StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import { createDocumentRelay, createDocumentSync, fetchSyncSpaces, type SubscribeDocument } from "pstdio-sync/relay";
import { personalIndexLogName } from "../personal-history/index-projection-sync";
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
  let ids: string[] = [];
  const changed = new Set<string>();
  let allIndexes = true;
  let downloaded = false;
  const knownIndexes = new Set<string>();
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
    owns: (id: string) => ids.includes(id),
    changed(id: string) {
      changed.add(id);
    },
    invalidateIndexes() {
      allIndexes = true;
    },
    async prepare(signal: AbortSignal) {
      await context.discardLegacy();
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
        allIndexes = true;
        downloaded = false;
        knownIndexes.clear();
        const recordsId = await keys.personal.documentId(JSON.stringify(["pstdio.personal-history", "records-v3"]));
        const sharedId = await keys.project.documentId(historyReferenceName);
        ids = [recordsId, sharedId];
        records = syncFor(context.history.owner, context.history.records, keys.personal, recordsId);
        shared = syncFor(context.references.owner, context.references.store, keys.project, sharedId);
      }
      spaces = keys;
      preparedRevision = revision;
      return { personal: keys.personal, renewed, recreated };
    },
    async status(pendingHeads = false) {
      const record = await records?.status();
      const index = record && {
        ...record,
        pending: record.pending || pendingHeads || (await context.history.indexPending()),
      };
      return documentProgress(
        [index && { ...index, downloaded: index.downloaded && downloaded }, await shared?.status()],
        true,
      );
    },
    async synchronize() {
      await records!.synchronize();
      const pending = new Set(changed);
      changed.clear();
      const full = allIndexes;
      allIndexes = false;
      try {
        const localPending = await context.history.indexPending();
        for (const entry of await context.logs.directory(context.history.owner)) {
          if (entry.name !== "index" || entry.writer !== "device") continue;
          const id = await spaces!.personal.documentId(personalIndexLogName(entry.stream));
          const added = !knownIndexes.has(id);
          knownIndexes.add(id);
          if (!ids.includes(id)) ids.push(id);
          input.subscribe(spaces!.personal.spaceOwner, id);
          if (
            full ||
            added ||
            pending.has(id) ||
            !downloaded ||
            (entry.stream === config.environmentId && localPending)
          )
            await context.history.synchronizeIndex(
              entry.stream,
              entry.stream === config.environmentId,
              spaces!.personal,
              relayFor(spaces!.personal),
            );
        }
        await shared!.synchronize();
        downloaded = true;
      } catch (error) {
        allIndexes = true;
        throw error;
      }
    },
  };
};
