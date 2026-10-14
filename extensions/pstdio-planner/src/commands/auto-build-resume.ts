import type { CommandContext, SessionRunSnapshot } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import {
  appendAttemptEvent,
  attemptEventsCollection,
  attemptSelectionsCollection,
  listAttempts,
} from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { hasPendingImplementationInput, isMergeOnlyInput } from "../data/implementation-input";
import { readTicketReviewRequests } from "../data/review-request-storage";
import type { ReviewRequestView } from "../data/review-request-types";
import { readImplementationCapacity } from "./attempt-readiness";
import { isLiveSession } from "./auto-build-sessions";

const ownsSelectedVariant = (
  attempt: AttemptRecord,
  attempts: AttemptRecord[],
  selections: { ticketId: string; workspaceId: string }[],
  retired: Set<string>,
) => {
  const selection = selections.find((s) => s.ticketId === attempt.ticketId);
  if (selection) return selection.workspaceId === attempt.workspaceId;
  return attempts.filter((a) => a.ticketId === attempt.ticketId && !retired.has(a.workspaceId)).length === 1;
};

const resumedEventId = (request: ReviewRequestView) => `human-input-resumed:${request.id}`;

export async function readAutoBuildResumptions(ctx: CommandContext) {
  const [attempts, requests] = await Promise.all([listAttempts(ctx.storage), readTicketReviewRequests(ctx.storage)]);
  const resumptions = new Map<
    string,
    { workspaceId: string; sessionId: string; expectedRun: SessionRunSnapshot; requests: ReviewRequestView[] }
  >();
  const retired = await readRetiredWorkspaceIds(ctx.storage);
  const selections = await attemptSelectionsCollection(ctx.storage).list();
  for (const attempt of attempts) {
    if (retired.has(attempt.workspaceId) || !ownsSelectedVariant(attempt, attempts, selections, retired)) continue;
    const group = requests.get(attempt.ticketId);
    if (!group || hasPendingImplementationInput(group)) continue;
    const answered = group.requests.filter(
      (request) =>
        request.state === "answered" &&
        !isMergeOnlyInput(request) &&
        request.context.workspaceId === attempt.workspaceId &&
        (request.context.relatedSessionId ?? request.context.sessionId) === attempt.implementationSessionId,
    );
    const pending: ReviewRequestView[] = [];
    for (const request of answered) {
      if (!(await attemptEventsCollection(ctx.storage).get(resumedEventId(request)))) pending.push(request);
    }
    if (pending.length) {
      const session = await ctx.sessions.get(attempt.implementationSessionId);
      if (
        session?.status === "completed" &&
        !(await ctx.sessions.listByWorkspace(attempt.workspaceId)).some((s) => s.id !== session.id && isLiveSession(s))
      ) {
        resumptions.set(attempt.ticketId, {
          workspaceId: attempt.workspaceId,
          sessionId: session.id,
          expectedRun: {
            status: session.status,
            startedAt: session.last_request_started ?? null,
            endedAt: session.last_request_ended ?? null,
          },
          requests: pending,
        });
      }
    }
  }
  return resumptions;
}

export async function resumeAutoBuildAttempt(
  ctx: CommandContext,
  ticketId: string,
  beforeDispatch: () => Promise<void>,
) {
  const resumption = (await readAutoBuildResumptions(ctx)).get(ticketId);
  if (!resumption) return { decision: "wait" as const, reason: "ticket-not-ready" };
  const { running, limit } = await readImplementationCapacity(ctx);
  if (running >= limit) return { decision: "wait" as const, reason: "capacity-full" };
  await beforeDispatch();
  const session = await ctx.sessions.get(resumption.sessionId);
  if (session?.status !== "completed") return { decision: "wait" as const, reason: "owner-changed" };
  await ctx.sessions.followup({
    sessionId: resumption.sessionId,
    expectedRun: resumption.expectedRun,
    prompt: [
      "Human input is resolved. Continue the implementation in the same workspace and attempt.",
      ...resumption.requests.map((request) => `${request.title}\n${request.instructions}\n${request.outcomeText}`),
    ].join("\n\n"),
  });
  for (const request of resumption.requests) {
    await appendAttemptEvent(ctx.storage, {
      id: resumedEventId(request),
      workspaceId: resumption.workspaceId,
      revision: request.context.attemptRevision,
      type: "implementation_resumed",
      actor: actorFromSource(ctx.source, ctx.invocationId),
      sessionId: resumption.sessionId,
      reportId: null,
      reviewId: null,
      threadId: null,
      commitSha: null,
      metadata: { humanRequestId: request.id },
    });
  }
  return { decision: "started" as const, workspaceId: resumption.workspaceId, sessionId: resumption.sessionId };
}
