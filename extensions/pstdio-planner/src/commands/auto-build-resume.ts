import type { CommandContext, SessionRunSnapshot } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import {
  appendAttemptEvent,
  attemptEventsCollection,
  attemptSelectionsCollection,
  listAttempts,
  putAttempt,
  readAttempt,
} from "../data/attempt-storage";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import { hasPendingImplementationInput, isMergeOnlyInput } from "../data/implementation-input";
import { readTicketReviewRequests } from "../data/review-request-storage";
import type { ReviewRequestView, TicketReviewRequests } from "../data/review-request-types";
import { readSessionHistory } from "../data/session-history";
import { readImplementationCapacity } from "./attempt-readiness";
import { isLiveSession } from "./auto-build-sessions";

const resumedEventId = (request: ReviewRequestView) => `human-input-resumed:${request.id}`;

type Session = Awaited<ReturnType<CommandContext["sessions"]["get"]>>;

export const isUnexpectedExit = (session: Session) =>
  session?.status === "disconnected" ||
  ["request_aborted", "worker_lost", "host_shutdown"].includes(session?.last_exit?.cause ?? "");

interface AutoBuildResumption {
  workspaceId: string;
  sessionId: string;
  eventId: string;
  revision: number | null;
  expectedRun: SessionRunSnapshot;
  unexpectedExit: boolean;
  requests: ReviewRequestView[];
}

const isChosenAttempt = (
  attempt: AttemptRecord,
  attempts: AttemptRecord[],
  selections: TicketAttemptSelection[],
  retired: Set<string>,
) => {
  const selection = selections.find(({ ticketId }) => ticketId === attempt.ticketId);
  if (selection) return selection.workspaceId === attempt.workspaceId;
  return (
    attempts.filter(({ ticketId, workspaceId }) => ticketId === attempt.ticketId && !retired.has(workspaceId))
      .length === 1
  );
};

const readPendingAnswers = async (ctx: CommandContext, attempt: AttemptRecord, requests: ReviewRequestView[]) => {
  const answered = requests.filter(
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
  return pending;
};

// An explicit user stop stays stopped. A lost run is recovered once in the same conversation.
const canContinue = (attempt: AttemptRecord, session: NonNullable<Session>) => {
  if (session.last_exit?.cause === "user_stop") return false;
  if (isUnexpectedExit(session)) return attempt.implementationDisconnectRetries === 0;
  return true;
};

const readResumption = async (
  ctx: CommandContext,
  attempt: AttemptRecord,
  group: TicketReviewRequests | undefined,
): Promise<AutoBuildResumption | null> => {
  if (group && hasPendingImplementationInput(group)) return null;
  const pending = await readPendingAnswers(ctx, attempt, group?.requests ?? []);
  const session = await ctx.sessions.get(attempt.implementationSessionId);
  if (!session || isLiveSession(session) || !canContinue(attempt, session)) return null;
  // Submitted work continues through stack, PR and CI repair unless its run was lost or a person answered.
  if (!pending.length && attempt.revisions.length && !isUnexpectedExit(session)) return null;
  // A workspace without readable history cannot be resumed safely; recovery handles a lost workspace.
  const others = await readSessionHistory(ctx.sessions, { workspaceId: attempt.workspaceId }).catch(() => null);
  if (!others || others.some(isLiveSession)) return null;
  // One stopped turn can be resumed once, even if a stale session snapshot is read again.
  const turn = session.updated_at ?? attempt.updatedAt;
  const eventId = `auto-build-resumed:${session.id}:${turn}`;
  if (!pending.length && (await attemptEventsCollection(ctx.storage).get(eventId))) return null;
  return {
    workspaceId: attempt.workspaceId,
    sessionId: session.id,
    eventId,
    revision: attempt.revisions.at(-1)?.revision ?? null,
    expectedRun: {
      status: session.status!,
      startedAt: session.last_request_started ?? null,
      endedAt: session.last_request_ended ?? null,
    },
    unexpectedExit: isUnexpectedExit(session),
    requests: pending,
  };
};

export async function readAutoBuildResumptions(ctx: CommandContext) {
  const [attempts, requests, selections, retired] = await Promise.all([
    listAttempts(ctx.storage),
    readTicketReviewRequests(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    readRetiredWorkspaceIds(ctx.storage),
  ]);
  const resumptions = new Map<string, AutoBuildResumption>();
  for (const attempt of attempts) {
    if (retired.has(attempt.workspaceId) || !isChosenAttempt(attempt, attempts, selections, retired)) continue;
    const resumption = await readResumption(ctx, attempt, requests.get(attempt.ticketId));
    if (resumption) resumptions.set(attempt.ticketId, resumption);
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
    expectedRun: resumption.expectedRun,
    prompt: [
      "Continue the unfinished implementation in the same workspace and managed attempt. Read the current implement-ticket skill and attempt history. Verify the dependency files and saved human answers before editing. If code is missing or stale, run update-stack with the current HEAD and owner session; this does not approve work or merge the target branch. A confirmed answer alone does not repair Git. Address outstanding findings, keep the ticket status current, validate, and submit the exact resulting revision.",
      ...resumption.requests.map((request) => `${request.title}\n${request.instructions}\n${request.outcomeText}`),
    ].join("\n\n"),
  });
  const attempt = await readAttempt(ctx.storage, resumption.workspaceId);
  if (attempt && resumption.unexpectedExit)
    await putAttempt(ctx.storage, {
      ...attempt,
      implementationDisconnectRetries: attempt.implementationDisconnectRetries + 1,
      updatedAt: new Date().toISOString(),
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
    metadata: resumption.unexpectedExit ? { reason: "unexpected-exit" } : {},
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
