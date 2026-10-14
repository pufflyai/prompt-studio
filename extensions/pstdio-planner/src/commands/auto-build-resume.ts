import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import {
  appendAttemptEvent,
  attemptEventsCollection,
  attemptSelectionsCollection,
  listAttempts,
} from "../data/attempt-storage";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import { hasPendingInput, readTicketReviewRequests } from "../data/review-request-storage";
import type { ReviewRequestView } from "../data/review-request-types";
import { readImplementationCapacity } from "./attempt-readiness";

const resumedEventId = (request: ReviewRequestView) => `human-input-resumed:${request.id}`;
const stoppedStatuses = new Set(["completed", "cancelled", "failed", "disconnected"]);

interface AutoBuildResumption {
  workspaceId: string;
  sessionId: string;
  eventId: string;
  revision: number | null;
  requests: ReviewRequestView[];
}

const isChosenAttempt = (attempt: AttemptRecord, attempts: AttemptRecord[], selections: TicketAttemptSelection[]) => {
  const selection = selections.find(({ ticketId }) => ticketId === attempt.ticketId);
  if (selection) return selection.workspaceId === attempt.workspaceId;
  return attempts.filter(({ ticketId, state }) => ticketId === attempt.ticketId && state !== "abandoned").length === 1;
};

const readPendingAnswers = async (ctx: CommandContext, attempt: AttemptRecord, requests: ReviewRequestView[]) => {
  const answered = requests.filter(
    (request) =>
      request.state === "answered" &&
      request.context.workspaceId === attempt.workspaceId &&
      (request.context.relatedSessionId ?? request.context.sessionId) === attempt.implementationSessionId,
  );
  const pending: ReviewRequestView[] = [];
  for (const request of answered) {
    if (!(await attemptEventsCollection(ctx.storage).get(resumedEventId(request)))) pending.push(request);
  }
  return pending;
};

export async function readAutoBuildResumptions(ctx: CommandContext) {
  const [attempts, requests, selections] = await Promise.all([
    listAttempts(ctx.storage),
    readTicketReviewRequests(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
  ]);
  const resumptions = new Map<string, AutoBuildResumption>();
  for (const attempt of attempts) {
    if (!isChosenAttempt(attempt, attempts, selections)) continue;
    if (attempt.state !== "implementing" && attempt.state !== "changes_requested") continue;
    const group = requests.get(attempt.ticketId);
    if (group && hasPendingInput(group)) continue;
    const pending = await readPendingAnswers(ctx, attempt, group?.requests ?? []);
    const session = await ctx.sessions.get(attempt.implementationSessionId);
    if (!session || !stoppedStatuses.has(session.status ?? "")) continue;
    // One stopped turn can be resumed once, even if a stale session snapshot is read again.
    const turn = session.updated_at ?? attempt.updatedAt;
    const eventId = `auto-build-resumed:${session.id}:${turn}`;
    if (!pending.length && (await attemptEventsCollection(ctx.storage).get(eventId))) continue;
    resumptions.set(attempt.ticketId, {
      workspaceId: attempt.workspaceId,
      sessionId: session.id,
      eventId,
      revision: attempt.revisions.at(-1)?.revision ?? null,
      requests: pending,
    });
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
  await ctx.sessions.followup({
    sessionId: resumption.sessionId,
    prompt: [
      "Continue the unfinished implementation in the same workspace and managed attempt. Read the current implement-ticket skill and attempt history. Verify the dependency files and saved human answers before editing. If code is missing or stale, run update-stack with the current HEAD and owner session; this does not approve work or merge the target branch. A confirmed answer alone does not repair Git. Address outstanding findings, validate, and submit the exact resulting revision.",
      ...resumption.requests.map((request) => `${request.title}\n${request.instructions}\n${request.outcomeText}`),
    ].join("\n\n"),
  });
  await appendAttemptEvent(ctx.storage, {
    id: resumption.eventId,
    workspaceId: resumption.workspaceId,
    revision: resumption.revision,
    type: "implementation_resumed",
    actor: actorFromSource(ctx.source, ctx.invocationId),
    sessionId: resumption.sessionId,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: null,
    metadata: {},
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
