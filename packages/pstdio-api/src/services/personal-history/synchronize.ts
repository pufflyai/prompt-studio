import type { SyncSpace } from "pstdio-sync";
import { createDocumentSync, type DocumentRelay, type SyncFailure } from "pstdio-sync/relay";
import { documentProgress } from "../relay/document-progress";
import type { PersonalHistoryStore } from "./store";

/** Uses the same encrypted document protocol as extension data, with the personal-space key. */
export const createPersonalDocumentSync = (input: {
  history: PersonalHistoryStore;
  space: SyncSpace;
  relay(documentId: string): DocumentRelay;
  quarantine(documentId: string, failure: SyncFailure): Promise<void>;
  statusChanged?: () => void;
}) => {
  const documents = new Map<string, ReturnType<typeof createDocumentSync>>();
  let directory: string[] | undefined;
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
    input.statusChanged?.();
  };
  return {
    invalidate() {
      directory = undefined;
    },
    async status() {
      const names = new Set(["records", ...documents.keys(), ...(directory ?? [])]);
      return documentProgress(
        await Promise.all([...names].map((name) => documents.get(name)?.status())),
        directory !== undefined,
      );
    },
    async synchronize(capture: () => Promise<void>) {
      directory = undefined;
      await capture();
      await synchronize();
      const ids = await input.history.transcriptNames();
      directory = ids.map(input.history.transcriptName);
      for (const id of ids) await synchronize(id);
      input.statusChanged?.();
    },
    close: () => {
      for (const sync of documents.values()) sync.close();
    },
  };
};
