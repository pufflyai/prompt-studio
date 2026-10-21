import type { SyncSpace } from "pstdio-sync";
import { createDocumentSync, type DocumentRelay, type SyncFailure } from "pstdio-sync/relay";
import type { PersonalHistoryStore } from "./store";

/** Uses the same encrypted document protocol as extension data, with the personal-space key. */
export const createPersonalDocumentSync = (input: {
  history: PersonalHistoryStore;
  space: SyncSpace;
  relay(documentId: string): DocumentRelay;
  quarantine(documentId: string, failure: SyncFailure): Promise<void>;
}) => {
  const documents = new Map<string, ReturnType<typeof createDocumentSync>>();
  const synchronize = async (id?: string) => {
    const name = id ? input.history.transcriptName(id) : "records";
    let sync = documents.get(name);
    if (!sync) {
      const documentId = await input.space.documentId(JSON.stringify(["pstdio.personal-history", name]));
      sync = createDocumentSync({
        owner: input.history.owner,
        store: id ? input.history.transcript(id) : input.history.records,
        space: input.space,
        documentId,
        relay: input.relay(documentId),
        quarantine: (failure) => input.quarantine(documentId, failure),
      });
      documents.set(name, sync);
    }
    await sync.synchronize();
  };
  return {
    async status() {
      const names = ["records", ...(await input.history.transcriptNames()).map(input.history.transcriptName)];
      const statuses = await Promise.all(names.map((name) => documents.get(name)?.status()));
      return {
        downloaded: statuses.every((status) => status?.downloaded),
        pending: statuses.some((status) => status?.pending),
        needsAttention: statuses.some((status) => status?.needsAttention),
      };
    },
    async synchronize(capture: () => Promise<void>) {
      await capture();
      await synchronize();
      for (const id of await input.history.transcriptNames()) await synchronize(id);
    },
    close: () => {
      for (const sync of documents.values()) sync.close();
    },
  };
};
