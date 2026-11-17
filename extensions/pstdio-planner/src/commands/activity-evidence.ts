import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptRecord, AttemptRevision } from "../data/attempt-types";
import { readReport } from "./legacy-report-evidence";
import type { ReviewFinding } from "./submit-review";

const resource = (ctx: CommandContext, attempt: AttemptRecord) => ({
  type: "ticket",
  id: attempt.ticketId,
  projectId: ctx.projectId,
  extensionId: ctx.extensionId,
});
const reportBelongs = async (ctx: CommandContext, id: string, workspaceId: string) => {
  const report = await readReport(ctx, id);
  if (report.id !== id || report.workspaceId !== workspaceId || report.draft)
    throw new Error("The saved report does not belong to this workspace.");
};
export const validateImplementationEvidence = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  ids: { changeRequestActivityId?: string; changeRequestReportId?: string },
  expected: { sessionId: string; headSha: string; baseSha: string; revision: number },
) => {
  if (Boolean(ids.changeRequestActivityId) === Boolean(ids.changeRequestReportId))
    throw new Error("Supply one implementation Activity entry (or one historical report).");
  if (!ids.changeRequestActivityId) return reportBelongs(ctx, ids.changeRequestReportId!, attempt.workspaceId);
  const entry = await ctx.activity.get(resource(ctx, attempt), ids.changeRequestActivityId);
  const evidence = entry.revision;
  if (
    entry.kind !== "implementation" ||
    !evidence ||
    evidence.workspaceId !== attempt.workspaceId ||
    evidence.sessionId !== expected.sessionId ||
    evidence.headSha !== expected.headSha ||
    evidence.baseSha !== expected.baseSha ||
    evidence.revision !== expected.revision
  )
    throw new Error("Implementation Activity does not match this session, workspace and exact revision.");
};
export const readReviewEvidence = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  revision: AttemptRevision,
  sessionId: string,
  input: { reviewActivityId?: string; reviewReportId?: string; verdict: string; threads?: ReviewFinding[] },
) => {
  if (Boolean(input.reviewActivityId) === Boolean(input.reviewReportId))
    throw new Error("Supply one review Activity entry (or one historical report).");
  if (!input.reviewActivityId) {
    await reportBelongs(ctx, input.reviewReportId!, attempt.workspaceId);
    return input.threads;
  }
  const entry = await ctx.activity.get(resource(ctx, attempt), input.reviewActivityId);
  const evidence = entry.revision;
  if (
    entry.kind !== "review" ||
    !evidence ||
    evidence.workspaceId !== attempt.workspaceId ||
    evidence.sessionId !== sessionId ||
    evidence.headSha !== revision.headSha ||
    evidence.baseSha !== revision.baseSha ||
    evidence.revision !== revision.revision ||
    entry.implementationId !== revision.changeRequestActivityId ||
    entry.verdict !== input.verdict
  )
    throw new Error("Review Activity does not match this reviewer and implementation revision.");
  if (input.threads && JSON.stringify(input.threads) !== JSON.stringify(entry.findings ?? []))
    throw new Error("Review findings must match the canonical Activity entry.");
  return entry.findings;
};
