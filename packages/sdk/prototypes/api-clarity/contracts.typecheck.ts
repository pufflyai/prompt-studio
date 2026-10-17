import type { RevisedApi } from "./contracts";

export const checkAuthoring = (ctx: RevisedApi) => {
  // @ts-expect-error Package files cannot be written.
  void ctx.files.package.writeText("template.md", "Changed");
  // @ts-expect-error Authors cannot expire notifications through setStatus.
  void ctx.notify.setStatus("review-1", "expired");
  // @ts-expect-error ID selection is a string, not a mixed selector object.
  void ctx.notify.setStatus({ id: "review-1", dedupeKey: "review" }, "done");
  // @ts-expect-error Saving requires the captured record and its revision.
  void ctx.storage.records.save("ticket-1", { title: "Changed" }, { operationId: "save-1" });
  // @ts-expect-error Attachment uploads require an explicit operation ID.
  void ctx.storage.attachments.add("ticket-1", new File([], "report.txt"));
};
