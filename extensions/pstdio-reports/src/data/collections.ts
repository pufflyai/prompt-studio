import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredReport } from "./types";

export const REPORTS_COLLECTION = "reports";

export const reportsCollection = (storage: ExtensionStorageApi) => storage.collection<StoredReport>(REPORTS_COLLECTION);

export const putReport = async (storage: ExtensionStorageApi, report: StoredReport) => {
  await reportsCollection(storage).put(report.id, report);
  return report;
};
