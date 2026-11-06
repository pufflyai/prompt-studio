import type { StorageOwner } from "pstdio-sync";
import { parseJsonPointer, prepareOrderedOperation } from "pstdio-sync/records";
import { fingerprint } from "pstdio-sync-contracts";
import type { OrderedJournal } from "./ordered-journal";
import { queueOrderedNativeOperation } from "./ordered-native-queue";
import { rebaseOrderedProjection } from "./ordered-rebase";
import type { OrderedTransaction } from "./ordered-sql";

/** Old native sync has no durable ACK boundary. Seeded full state replays clean structs idempotently. */
export const migrateLegacyNativeFields = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  ids: string[],
) => {
  for (let offset = 0; offset < ids.length; offset += 100) {
    const selected = ids.slice(offset, offset + 100);
    const { views } = await rebaseOrderedProjection(journal, tx, owner, selected);
    for (const id of selected) {
      const record = views.get(id);
      if (!record || record.deleted) continue;
      for (const [pointer, text] of Object.entries(record.texts ?? {})) {
        const path = parseJsonPointer(pointer);
        const identity = await fingerprint([owner.workbenchId, owner.extensionId, id, path, text.seed, text.state]);
        const operation = await prepareOrderedOperation(
          {
            operationId: `legacy-native:${identity}`,
            edits: [
              {
                recordId: id,
                changes: [],
                texts: [{ path, seed: text.seed, update: text.state, dependencies: text.pending }],
              },
            ],
          },
          views,
        );
        await queueOrderedNativeOperation(journal, tx, owner, operation, identity, views);
      }
    }
  }
};
