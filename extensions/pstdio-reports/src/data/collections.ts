import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredReport } from "./types";

export const REPORTS_COLLECTION = "reports";

export const reportsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredReport>(REPORTS_COLLECTION);

export const putReport = async (storage: ExtensionStorageApi, report: StoredReport) => {
  // Older report records copied core's number. Drop it when saving those records too.
  const { shorthand: _shorthand, ...record } = report as StoredReport & { shorthand?: string };
  await reportsCollection(storage).put(record.id, record);
  return record;
};
