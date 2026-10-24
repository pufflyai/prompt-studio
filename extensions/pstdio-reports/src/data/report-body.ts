import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { reportsCollection } from "./collections";
import type { StoredReport } from "./types";

// Report bodies can hold long pasted logs. Storage records are for small structured data, so the
// body is a blob next to the evidence files and the record keeps only its ID.
export const storeReportBody = async (storage: ExtensionStorageApi, reportId: string, body: string) => {
  const blob = await reportsCollection(storage)
    .attachments(reportId)
    .put({ name: "report.md", data: new TextEncoder().encode(body), mimeType: "text/markdown" });
  return blob.id;
};

export const readReportBody = async (storage: ExtensionStorageApi, report: StoredReport) =>
  new TextDecoder().decode(await reportsCollection(storage).attachments(report.id).getBytes(report.bodyBlobId));
