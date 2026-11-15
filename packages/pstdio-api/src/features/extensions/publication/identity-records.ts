import { canonicalExtensionId, historicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { GroupCommit } from "pstdio-sync/records";
import type { StorageRecord } from "pstdio-sync-contracts";
import type { CatalogRecords } from "./catalog-store";
import { packageMetadataSchema } from "./types";

type Reader = Pick<CatalogRecords, "read" | "commit">;
const conflict = (id: string) =>
  new Error(`Published extension identity conflict: ${id}. Both selector histories were retained.`);
const decoded = (record: StorageRecord) => {
  const metadata = packageMetadataSchema.safeParse(record.value);
  return {
    ...record,
    recordId: canonicalExtensionId(record.recordId),
    value: metadata.success
      ? { ...metadata.data, extensionId: canonicalExtensionId(metadata.data.extensionId) }
      : record.value,
  };
};
const selected = async (records: Reader, id: string) => {
  const canonical = canonicalExtensionId(id);
  const historical = historicalExtensionId(canonical);
  const previous = await records.read(historical);
  if (canonical === historical) return previous;
  const current = await records.read(canonical);
  if (previous.exists && current.exists) throw conflict(canonical);
  return current.exists ? current : previous;
};
const view = (records: Reader) => ({
  read: async (id: string) => decoded(await selected(records, id)),
  commit: async (group: GroupCommit) => {
    const edits = await Promise.all(
      group.edits.map(async (edit) => ({
        ...edit,
        recordId: (await selected(records, edit.recordId)).recordId,
      })),
    );
    return records.commit({ ...group, edits });
  },
});

/** Keep actual selector keys and sealed history; decode only platform-owned logical metadata. */
export const canonicalPublicationRecords = (records: CatalogRecords): CatalogRecords => ({
  ...view(records),
  list: async () => {
    const seen = new Set<string>();
    return (await records.list()).map((record) => {
      const canonical = decoded(record);
      if (seen.has(canonical.recordId)) throw conflict(canonical.recordId);
      seen.add(canonical.recordId);
      return canonical;
    });
  },
  transaction: (run) => records.transaction((locked) => run(view(locked))),
});
