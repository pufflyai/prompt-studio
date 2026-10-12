import type { CommandContext } from "@pstdio/sdk/extensions";
import { actorFromSource } from "../data/attempt-actors";
import { appendAttemptEvent, attemptEventsCollection, listAttempts } from "../data/attempt-storage";
import { hasPendingInput, readTicketReviewRequests } from "../data/review-request-storage";
import type { ReviewRequestView } from "../data/review-request-types";
import { readImplementationCapacity } from "./attempt-readiness";

const resumedEventId = (request: ReviewRequestView) => `human-input-resumed:${request.id}`;

export async function readAutoBuildResumptions(ctx: CommandContext) {
  const [attempts, requests] = await Promise.all([listAttempts(ctx.storage), readTicketReviewRequests(ctx.storage)]);
  const resumptions = new Map<string, { workspaceId: string; sessionId: string; requests: ReviewRequestView[] }>();
  for (const attempt of attempts) {
    if (attempt.state !== "implementing" && attempt.state !== "changes_requested") continue;
    const group = requests.get(attempt.ticketId);
    if (!group || hasPendingInput(group)) continue;
    const answered = group.requests.filter(
      (request) =>
        request.state === "answered" &&
        request.context.workspaceId === attempt.workspaceId &&
        (request.context.relatedSessionId ?? request.context.sessionId) === attempt.implementationSessionId,
    );
    const pending: ReviewRequestView[] = [];
    for (const request of answered) {
      if (!(await attemptEventsCollection(ctx.storage).get(resumedEventId(request)))) pending.push(request);
    }
    if (pending.length) {
      const session = await ctx.sessions.get(attempt.implementationSessionId);
      if (session?.status === "completed") {
        resumptions.set(attempt.ticketId, {
          workspaceId: attempt.workspaceId,
          sessionId: session.id,
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
  await ctx.sessions.followup({
    sessionId: resumption.sessionId,
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
