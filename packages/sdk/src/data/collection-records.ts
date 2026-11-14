import type { ExtensionStorageApi } from "pstdio-api-contracts/extension-kernel";

/** Read at most 100 collection rows selected by an index, preserving order and missing rows. */
export const readCollectionRecords = async <T>(storage: Pick<ExtensionStorageApi, "records">, recordIds: string[]) =>
  (await storage.records.readMany(recordIds)).map((record) =>
    record.exists && !record.deleted ? (record.value as { value: T }).value : undefined,
  );
