import type { GroupCommit, LockedRecords } from "pstdio-sync";
import type { Asset, StorageRecord } from "pstdio-sync-contracts";
import { type Publication, packageMetadataSchema, selectionSchema } from "./types";

/** The records API of one storage owner. Each record is its own document (ADR 0100). */
export interface CatalogRecords {
  read(id: string): Promise<StorageRecord>;
  list(): Promise<StorageRecord[]>;
  commit(group: GroupCommit): Promise<unknown>;
  transaction<T>(run: (records: LockedRecords) => Promise<T>): Promise<T>;
}

/** A mutable package selector points at one immutable metadata-and-bytes record. */
export const createPublicationCatalog = (input: {
  records: CatalogRecords;
  verifyComplete: (assets: Asset[]) => Promise<void>;
}) => {
  const { records } = input;
  const resolve = async (selected: StorageRecord, reader: Pick<CatalogRecords, "read">) => {
    const id = selected.recordId;
    if (selected.deleted || selected.value === null) return { ...selected, value: null, asset: null };
    const selection = selectionSchema.parse(selected.value);
    const pkg = await reader.read(`package:${selection.revision}`);
    const metadata = packageMetadataSchema.parse(pkg.value);
    if (metadata.extensionId !== id || !pkg.asset || pkg.asset.sha256 !== selection.revision)
      throw new Error("Published package identity mismatch");
    return { ...selected, value: { ...metadata, ...selection }, asset: pkg.asset };
  };
  const view = (reader: Pick<CatalogRecords, "read">) => ({
    records: reader,
    read: async (id: string) => resolve(await reader.read(id), reader),
  });
  // Reads and the following commit share one owner lock, so a stale caller cannot overwrite a newer choice.
  const change = <T>(
    id: string,
    expectedRevision: string | undefined,
    action: (catalog: ReturnType<typeof view> & { records: LockedRecords }) => Promise<T>,
  ) =>
    records.transaction(async (locked) => {
      const record = await locked.read(id);
      if (expectedRevision !== undefined && record.revision !== expectedRevision)
        throw new Error("Published extension changed; read its revision again");
      return action({ ...view(locked), records: locked });
    });
  return {
    ...view(records),
    records,
    change,
    list: async () =>
      Promise.all(
        (await records.list())
          .filter((record) => !record.recordId.startsWith("package:") && !record.deleted)
          .map((record) => resolve(record, records)),
      ),
    select: async (publication: Publication, asset: Asset, expectedRevision?: string) => {
      if (asset.sha256 !== publication.revision) throw new Error("Published package identity mismatch");
      // Hashing package bytes stays outside the owner lock.
      await input.verifyComplete([asset]);
      return change(publication.extensionId, expectedRevision, ({ records }) =>
        records.commit({
          operationId: crypto.randomUUID(),
          edits: [
            {
              recordId: `package:${publication.revision}`,
              replace: {
                extensionId: publication.extensionId,
                version: publication.version,
                automation: publication.automation,
              },
              asset,
            },
            {
              recordId: publication.extensionId,
              expectedRevision,
              replace: { revision: publication.revision, enabled: publication.enabled },
              deleted: false,
            },
          ],
        }),
      );
    },
  };
};
