import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import type { SessionLogFiles } from "../personal-history/log-files";
import { createLogPublisher } from "../personal-history/log-publisher";
import type { PersonalLogStreams } from "../personal-history/log-stream";
import type { PersonalHistoryStore } from "../personal-history/store";
import type { createPersonalDocuments } from "./personal-documents";
import { createPersonalPublications } from "./personal-publications";

/** Heads flush with metadata or once a minute while completed messages continue arriving. */
export const createPersonalPublication = (input: {
  files: SessionLogFiles;
  namespace: string;
  deviceId: string;
  streams: PersonalLogStreams;
  deps: ExtensionsRouteDeps;
  interested: (id: string) => boolean;
  published: (id: string) => void;
  failed: (id: string) => void;
  wake: () => void;
  statusChanged?: () => void;
  history: PersonalHistoryStore;
  documents: ReturnType<typeof createPersonalDocuments>;
}) => {
  const publications = createPersonalPublications({
    history: input.history,
    wake: input.wake,
    published: (id) => {
      input.published(id);
      input.statusChanged?.();
    },
  });
  const publisher = createLogPublisher({ ...input, published: publications.published });
  return {
    ...publisher,
    hasPendingHeads: publications.pending,
    watch(id: string, active: boolean, send: Parameters<typeof publisher.live>[2]) {
      const space = input.documents.space;
      if (!active || !space) {
        publisher.finishLive(id);
        return;
      }
      publisher.live(id, space, send);
      void publisher.publish([id], space, input.documents.relayFor(space)).catch(() => input.failed(id));
    },
    async synchronizeIndex(full: boolean, captured: boolean, remoteChanged: boolean) {
      const writeHeads = await publications.flush(full, captured);
      const pending = (captured || writeHeads) && (await input.documents.status()).pending;
      if (!full && !remoteChanged && !pending) return false;
      await input.documents.synchronize();
      return true;
    },
    close() {
      publications.close();
      publisher.close();
    },
  };
};
