import type { StorageLogRead } from "pstdio-sync-contracts";
import { decodeBytes } from "../shared";
import { ensureLogHistory, publishLogCheckpoint } from "./log-checkpoint";
import { logPageLimit } from "./log-cursor";
import { createLogReader } from "./log-reader";
import { openLogState } from "./log-state";
import { createLogTransfers } from "./log-transfer";
import type { LogSyncInput } from "./log-types";
export const createLogStreamSync = (input: LogSyncInput) => {
  const { space, documentId, relay, store } = input;
  const transfers = createLogTransfers(input);
  const { connect, prepare, wireUpdate, materialize, retained } = transfers;
  const { readNewest, readAfter } = createLogReader(input, transfers);
  return {
    async publish() {
      const first = await ensureLogHistory(input, transfers);
      const state = await openLogState(space, documentId, relay, first.state);
      const { blobs } = await connect();
      let published = false;
      const through = await store.pendingThrough();
      while (true) {
        const pending = await store.pending(100, through);
        if (!pending.length) break;
        const delivery = await prepare(pending);
        for (const blob of delivery.blobs) await blobs.put(blob.blobId, decodeBytes(blob.bytes), blob.children);
        const result = await relay.update(delivery.envelope);
        const metadata = await wireUpdate(delivery.envelope);
        const entries = await materialize(metadata, new Set(retained(metadata).map((entry) => entry.index)));
        await store.receive(
          [
            {
              sequence: state.offset + result.sequence,
              entries,
              expected: retained(metadata).map((entry) => ({ id: entry.id, fingerprint: entry.fingerprint })),
            },
          ],
          state.offset + result.sequence,
          { from: state.offset + result.sequence - 1 },
        );
        published = true;
      }
      if (published) await publishLogCheckpoint(input, transfers);
    },
    async read(options: StorageLogRead = {}) {
      const limit = logPageLimit(options.limit);
      const first = await ensureLogHistory(input, transfers);
      const state = await openLogState(space, documentId, relay, first.state);
      let more = false;
      if (options.newest) await readNewest(first, state, limit);
      else more = await readAfter(first, state, options, limit);
      const page = await store.read(options);
      return { ...page, more: page.more || more };
    },
    compact: () => publishLogCheckpoint(input, transfers),
  };
};
