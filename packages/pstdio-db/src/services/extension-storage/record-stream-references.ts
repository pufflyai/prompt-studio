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
  const getMany = (hashes: string[]) =>
    deps.metadata(owner, async ({ document }) => {
      const saved = document.getMap("record-blobs");
      const references = new Map<string, AssetReference>();
      for (const sha256 of hashes) {
        const parsed = assetReferenceSchema.safeParse(saved.get(sha256));
        if (parsed.success) references.set(sha256, parsed.data);
      }
      return references;
    });
  const setMany = (references: AssetReference[]) =>
    deps.metadata(owner, async ({ document }) => {
      const saved = document.getMap("record-blobs");
      for (const reference of references) saved.set(reference.asset.sha256, reference);
    });
  return {
    get: async (sha256: string) => (await getMany([sha256])).get(sha256),
    set: (reference: AssetReference) => setMany([reference]),
    getMany,
    setMany,
  };
};
