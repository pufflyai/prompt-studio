import { isDeepStrictEqual } from "node:util";
import { defineCommand, l10n, params, type ResourceActivityEntry, type ResourceRef } from "@pstdio/sdk/extensions";
import { reportsCollection } from "../data/collections";
import { readReportWithBody } from "../data/report-body";
import { replaceReport, withReportWrite } from "../data/report-write";
export const exportReportCommand = defineCommand({
  id: "reports.export",
  title: l10n("reports.export.title", "Read historical report evidence"),
  params: { id: params.text({ required: true }) },
  async run(ctx, input) {
    const report = await readReportWithBody(ctx.storage, input.id, ctx.activity);
    if (!report) throw new Error("Report not found.");
    const files = [];
    const blobs = reportsCollection(ctx.storage).attachments(report.id);
    for (const file of report.files) {
      const first = report.activityRefs?.[0];
      const bytes =
        first && file.activityAttachmentId
          ? (await ctx.activity.readAttachment(first.resource, file.activityAttachmentId)).data
          : await blobs.getBytes(file.blobId);
      files.push({ ...file, base64: Buffer.from(bytes).toString("base64") });
    }
    return { report, files };
  },
});
const verifiedAttachment = (entry: ResourceActivityEntry, file: { name: string; hash: string | null; size: number }) =>
  entry.attachments.find(
    (attachment) => attachment.name === file.name && attachment.sha256 === file.hash && attachment.size === file.size,
  );
export const redirectReportCommand = defineCommand({
  id: "reports.redirect",
  title: l10n("reports.redirect.title", "Preserve report references in Activity"),
  params: {
    id: params.text({ required: true }),
    resource: params.json<ResourceRef, { required: true }>({ required: true }),
    entryId: params.text({ required: true }),
  },
  async run(ctx, input) {
    return withReportWrite(ctx, input.id, async () => {
      const snapshot = await reportsCollection(ctx.storage).read(input.id);
      if (!snapshot) throw new Error("Report not found.");
      const report = snapshot.value;
      const entry = await ctx.activity.get(input.resource, input.entryId);
      if (entry.origin?.resource.id !== report.id || entry.origin.resource.extensionId !== ctx.extensionId)
        throw new Error("Activity does not preserve this report's source reference.");
      const original = await readReportWithBody(ctx.storage, report.id, ctx.activity);
      if (original?.body !== entry.body || entry.attachments.length !== report.files.length)
        throw new Error("Report evidence has not been fully preserved.");
      if (report.files.some((file) => !verifiedAttachment(entry, file)))
        throw new Error("Report attachment verification failed.");
      const next = await replaceReport(ctx.storage, snapshot.revision, {
        ...report,
        activityRefs: [
          { resource: input.resource, id: entry.id },
          ...(report.activityRefs ?? []).filter((reference) => reference.id !== entry.id),
        ],
        cleanupBlobIds:
          report.cleanupBlobIds ?? [report.bodyBlobId, ...report.files.map((file) => file.blobId)].filter(Boolean),
        bodyBlobId: "",
        files: report.files.map((file) => ({
          ...file,
          blobId: "",
          activityAttachmentId: verifiedAttachment(entry, file)!.id,
        })),
      });
      const saved = await reportsCollection(ctx.storage).read(report.id);
      if (!saved || !isDeepStrictEqual(saved.value, JSON.parse(JSON.stringify(next))))
        throw new Error("Report changed before cleanup. Retry migration.");
      const blobs = reportsCollection(ctx.storage).attachments(report.id);
      for (const id of next.cleanupBlobIds ?? []) await blobs.delete(id);
      const { cleanupBlobIds: _cleanup, ...cleaned } = next;
      await replaceReport(ctx.storage, saved.revision, cleaned);
      return { id: next.id, activityRefs: next.activityRefs };
    });
  },
});
