import { type CommandContext, defineCommand, params, type SessionRunSnapshot } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { appendAttemptEvent, attemptEventsCollection, readAttempt } from "../data/attempt-storage";
import { hasPendingImplementationInput } from "../data/implementation-input";
import { listTicketReviewRequests } from "../data/review-request-storage";
import { readSessionHistory } from "../data/session-history";
import { withWriteGuard } from "../data/write-guard";
import { readImplementationCapacity } from "./attempt-readiness";
import { isLiveSession } from "./auto-build-sessions";
import { workspaceHead } from "./change-requests";

const assertNoCompetingWriter = async (ctx: CommandContext, workspaceId: string, sessionId: string) => {
  if (
    (await readSessionHistory(ctx.sessions, { workspaceId: workspaceId })).some(
      (other) => other.id !== sessionId && isLiveSession(other),
    )
  )
    throw new Error("Another session is executing in this workspace. Wait for acknowledged handoff.");
};

const alreadyRequested = async (ctx: CommandContext, key: string | undefined) =>
  key &&
  (await attemptEventsCollection(ctx.storage).list()).some(
    (event) => event.metadata.evidenceKey === key || event.id === key,
  );

export const repairAttempt = async (
  ctx: CommandContext,
  input: {
    workspaceId: string;
    expectedHeadSha: string;
    reason: string;
    evidenceKey?: string;
    expectedRun?: SessionRunSnapshot;
  },
) => {
  return withWriteGuard(ctx, `attempt:${input.workspaceId}`, async () => {
    const attempt = await readAttempt(ctx.storage, input.workspaceId);
    if (!attempt || (await readRetiredWorkspaceIds(ctx.storage)).has(attempt.workspaceId))
      throw new Error("Choose a current implementation variant.");
    if ((await workspaceHead(ctx, attempt.workspaceId)) !== input.expectedHeadSha)
      throw new Error("Workspace HEAD changed before repair.");
    if (hasPendingImplementationInput(await listTicketReviewRequests(ctx.storage, attempt.ticketId)))
      throw new Error("Resolve implementation input before repair.");
    const session = await ctx.sessions.get(attempt.implementationSessionId);
    if (!session)
      throw new Error(
        "The implementation owner is missing. Arrange an acknowledged handoff before assigning another writer.",
      );
    const capacity = await readImplementationCapacity(ctx);
    if (!isLiveSession(session) && capacity.running >= capacity.limit)
      throw new Error("Implementation capacity is full.");
    await assertNoCompetingWriter(ctx, attempt.workspaceId, session.id);
    if (await alreadyRequested(ctx, input.evidenceKey))
      return { decision: "already-requested" as const, sessionId: session.id };
    const outcome = await ctx.sessions.followup({
      sessionId: session.id,
      expectedRun: input.expectedRun,
      prompt: `${input.reason}\n\nContinue in workspace ${attempt.workspaceShorthand}. Read current workflow status IDs and update ticket progress. Follow the task's validation, adversarial review, PR and CI rules. Save a report and submit the exact new HEAD with submit-revision. A queued follow-up does not transfer ownership. Do not merge without authority.`,
    });
    await appendAttemptEvent(ctx.storage, {
      id: input.evidenceKey?.startsWith("unfinished:") ? input.evidenceKey : undefined,
      workspaceId: attempt.workspaceId,
      revision: attempt.revisions.at(-1)?.revision ?? null,
      type: "implementation_resumed",
      actor: actorFromSource(ctx.source, ctx.invocationId),
      sessionId: session.id,
      reportId: null,
      reviewId: null,
      threadId: null,
      commitSha: input.expectedHeadSha,
      metadata: { reason: input.reason, evidenceKey: input.evidenceKey ?? null, queued: isLiveSession(session) },
    });
    return {
      decision: isLiveSession(session) ? ("queued" as const) : ("resumed" as const),
      sessionId: session.id,
      workspaceId: attempt.workspaceId,
      outcome,
    };
  });
};

export const repairAttemptCommand = defineCommand({
  id: "repair-attempt",
  title: "Continue work in the owned workspace",
  cli: true,
  mutating: true,
  params: {
    workspaceId: params.text({ required: true }),
    expectedHeadSha: params.text({ required: true }),
    reason: params.longText({ required: true }),
    evidenceKey: params.text(),
  },
  async run(ctx, input) {
    return withWriteGuard(ctx, "attempt-launch", () => repairAttempt(ctx, input));
  },
});
