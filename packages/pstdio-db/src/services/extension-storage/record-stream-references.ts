import type { DocumentStore, StorageOwner } from "pstdio-sync";
import { type AssetReference, assetReferenceSchema } from "pstdio-sync-contracts";
import type { createProjectionStatistics } from "./projection-statistics";
import type { NumberChange } from "./resource-number-repair";

export interface RecordStreamDependencies {
  statistics: ReturnType<typeof createProjectionStatistics>;
  /** Notifies owner watchers after downloaded records change. */
  changed: (recordIds?: readonly string[]) => void;
  numbersChanged?: (events: NumberChange[]) => void;
  /** The owner's metadata document, which remembers where each asset's ciphertext lives. */
  metadata: DocumentStore["transaction"];
}
export const createRecordStreamReferences = (owner: StorageOwner, deps: RecordStreamDependencies) => {
  return {
    get: (sha256: string) =>
      deps.metadata(owner, async ({ document }) => {
        const parsed = assetReferenceSchema.safeParse(document.getMap("record-blobs").get(sha256));
        return parsed.success ? parsed.data : undefined;
      }),
    set: (reference: AssetReference) =>
      deps.metadata(owner, async ({ document }) => {
        document.getMap("record-blobs").set(reference.asset.sha256, reference);
      }),
  };
};
