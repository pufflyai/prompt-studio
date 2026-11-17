import { createHash } from "node:crypto";
import {
  type ActivityAuthor,
  type ActivityRevision,
  type CommandContext,
  commandRef,
  defineCommand,
  l10n,
  params,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { listAttempts, putAttempt, readAttempt } from "../data/attempt-storage";
import type { AttemptRecord, ActorRef as PlannerActor } from "../data/attempt-types";
import { findTicket } from "../data/resolve";
import { withQueuedWriteGuard } from "../data/write-guard";

interface ReportExport {
  report: {
    id: string;
    body: string;
    createdAt: string;
    activityRefs?: { resource: ResourceRef; id: string }[];
    files: { name: string; hash: string; size: number }[];
  };
  files: { id: string; name: string; mimeType: string | null; base64: string }[];
}
const reports = commandRef.forExtension({ publisher: "pstdio", name: "pstdio-reports" });
const exportReport = reports<{ id: string }, ReportExport>("reports.export");
const redirectReport = reports<{ id: string; resource: ResourceRef; entryId: string }, unknown>("reports.redirect");
const authorTypes = { human: "user", agent: "agent", automation: "system" } as const;
const originalAuthor = (actor: PlannerActor) =>
  ({ type: authorTypes[actor.type], id: actor.id, name: actor.displayName }) satisfies ActivityAuthor;
const migrate = async (
  ctx: CommandContext,
  resource: ResourceRef,
  input: {
    reportId?: string | null;
    activityId?: string;
    kind: "implementation" | "review";
    revision: ActivityRevision;
    author: PlannerActor;
    implementationId?: string;
    verdict?: "passed" | "changes_requested" | null;
    reviewId?: string;
  },
) => {
  let reportId = input.reportId;
  if (input.activityId) {
    const existing = await ctx.activity.get(resource, input.activityId);
    if (
      existing.kind !== input.kind ||
      !existing.revision ||
      Object.entries(input.revision).some(
        ([field, value]) => existing.revision![field as keyof ActivityRevision] !== value,
      ) ||
      existing.implementationId !== input.implementationId ||
      existing.verdict !== (input.verdict ?? undefined)
    )
      throw new Error("Historical Activity does not match this exact outcome revision.");
    if (existing.origin?.resource.extensionId !== "pstdio.pstdio-reports") return existing.id;
    reportId ??= existing.origin.resource.id;
    if (reportId !== existing.origin.resource.id) throw new Error("Historical outcome source changed.");
    const redirected = await ctx.commands.execute(redirectReport, {
      params: { id: reportId, resource, entryId: existing.id },
    });
    if (!redirected.ok) throw new Error(redirected.reason);
    return existing.id;
  }
  if (!reportId) return input.activityId;
  const exported = await ctx.commands.execute(exportReport, { params: { id: reportId } });
  if (!exported.ok) throw new Error(exported.reason);
  const { report, files } = exported.value;
  let id: string;
  {
    const key = createHash("sha256")
      .update(JSON.stringify([report.id, report.body, files.map((file) => [file.id, file.base64]), input]))
      .digest("hex");
    const attachmentIds = [];
    for (const file of files)
      attachmentIds.push(
        (
          await ctx.activity.attach(resource, {
            key: `report:${report.id}:file:${file.id}:${createHash("sha256").update(file.base64).digest("hex")}`,
            name: file.name,
            mimeType: file.mimeType ?? "application/octet-stream",
            data: new Uint8Array(Buffer.from(file.base64, "base64")),
          })
        ).id,
      );
    const entry = await ctx.activity.importEntry(resource, {
      entry: {
        key: `report:${report.id}:${key}`,
        kind: input.kind,
        body: report.body,
        revision: input.revision,
        implementationId: input.implementationId,
        verdict: input.verdict ?? undefined,
        attachmentIds,
      },
      author: originalAuthor(input.author),
      createdAt: report.createdAt,
      source: { projectId: ctx.projectId, extensionId: "pstdio.pstdio-reports", type: "report", id: report.id },
    });
    id = entry.id;
  }
  const redirected = await ctx.commands.execute(redirectReport, { params: { id: report.id, resource, entryId: id } });
  if (!redirected.ok) throw new Error(redirected.reason);
  return id;
};
const migrateReviews = async (
  ctx: CommandContext,
  resource: ResourceRef,
  reviews: AttemptRecord["revisions"][number]["reviews"],
  context: ActivityRevision,
  implementationId: string,
) => {
  const migrated: typeof reviews = [];
  for (const review of reviews) {
    if (!(review.reportId || review.activityId) || !review.verdict || !review.sessionId) {
      migrated.push(review);
      continue;
    }
    const activityId = await migrate(ctx, resource, {
      reportId: review.reportId,
      activityId: review.activityId,
      kind: "review",
      revision: { ...context, sessionId: review.sessionId, headSha: review.reviewedHeadSha },
      author: review.reviewer,
      implementationId,
      verdict: review.verdict,
      reviewId: review.id,
    });
    migrated.push({ ...review, activityId, reportId: null });
  }
  return migrated;
};
export const migrateTicketOutcomesCommand = defineCommand({
  id: "migrate-ticket-outcomes",
  title: l10n("activity.migrate", "Move historical outcomes to ticket Activity"),
  cli: true,
  params: { id: params.text({ required: true }) },
  async run(ctx, input) {
    const ticket = await findTicket(ctx, input.id);
    if (!ticket) throw new Error("Ticket not found.");
    const resource = { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "ticket", id: ticket.id };
    const attempts = (await listAttempts(ctx.storage)).filter((attempt) => attempt.ticketId === ticket.id);
    for (const attempt of attempts)
      await withQueuedWriteGuard(ctx, `attempt:${attempt.workspaceId}`, async () => {
        const latest = await readAttempt(ctx.storage, attempt.workspaceId);
        if (!latest || latest.ticketId !== ticket.id) throw new Error("Attempt ownership changed before migration.");
        let current: AttemptRecord = latest;
        for (let index = 0; index < current.revisions.length; index++) {
          const revision = current.revisions[index]!;
          const context = {
            workspaceId: current.workspaceId,
            sessionId: current.implementationSessionId,
            headSha: revision.headSha,
            baseSha: revision.baseSha,
            revision: revision.revision,
          };
          const implementationId = await migrate(ctx, resource, {
            reportId: revision.changeRequestReportId,
            activityId: revision.changeRequestActivityId,
            kind: "implementation",
            revision: context,
            author: revision.submittedBy,
          });
          if (!implementationId) continue;
          const reviews = await migrateReviews(ctx, resource, revision.reviews, context, implementationId);
          current = {
            ...current,
            revisions: current.revisions.map((candidate, at) =>
              at === index
                ? { ...candidate, changeRequestActivityId: implementationId, changeRequestReportId: null, reviews }
                : candidate,
            ),
          };
          await putAttempt(ctx.storage, current);
        }
      });
    return { ticketId: ticket.id, attempts: attempts.length };
  },
});
