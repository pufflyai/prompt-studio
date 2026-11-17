import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { reportsCollection } from "./collections";

// Report bodies can hold long pasted logs. Storage records are for small structured data, so the
// body is a blob next to the evidence files and the record keeps only its ID.
export const reportBodyFile = (body: string) => ({
  name: "report.md",
  data: new TextEncoder().encode(body),
  mimeType: "text/markdown",
});

/** The current report with its body, or undefined when the report does not exist. */
export const readReportWithBody = async (
  storage: ExtensionStorageApi,
  id: string,
  activity?: Pick<import("@pstdio/sdk/extensions").ResourceActivityApi, "get">,
) => {
  const reports = reportsCollection(storage);
  let report = await reports.get(id);
  while (report) {
    if (report.activityRefs?.length) {
      if (!activity) throw new Error("Read this historical report through its Activity reference.");
      return {
        ...report,
        body: (await activity.get(report.activityRefs[0]!.resource, report.activityRefs[0]!.id)).body,
      };
    }
    try {
      const bytes = await reports.attachments(id).getBytes(report.bodyBlobId);
      return { ...report, body: new TextDecoder().decode(bytes) };
    } catch (error) {
      // A save can replace the record and delete its old body between the two reads.
      const latest = await reports.get(id);
      if (latest?.bodyBlobId === report.bodyBlobId) throw error;
      report = latest;
    }
  }
  return undefined;
};
