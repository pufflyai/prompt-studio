import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { isAttemptRecord } from "./attempt-storage";
import type { AttemptRecord } from "./attempt-types";
import { upgradeAttemptStorage } from "./attempt-upgrade";
import { preparePlannerIndexes } from "./storage-indexes";

export const readAttemptPage = async (
  storage: ExtensionStorageApi,
  input: { limit?: number; cursor?: string } = {},
) => {
  await upgradeAttemptStorage(storage);
  await preparePlannerIndexes(storage);
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Choose a variant page size from 1 to 100");
  const total = await storage.records.aggregate({ index: "attempt-schema" });
  const page = await storage.records.query({
    index: "attempt-schema",
    fields: [],
    limit,
    cursor: input.cursor,
    revision: total.revision,
  });
  const variants = (
    await readCollectionRecords<AttemptRecord>(
      storage,
      page.records.map(({ recordId }) => recordId),
    )
  ).flatMap((record) => {
    if (!record) return [];
    if (!isAttemptRecord(record)) throw new Error("Invalid Planner attempt record");
    return [record];
  });
  return { variants, total: total.count, revision: page.revision, cursor: page.cursor };
};
