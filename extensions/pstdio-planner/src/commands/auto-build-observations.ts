import type { CommandContext, SessionRunSnapshot } from "@pstdio/sdk/extensions";
import type { AttemptRecord, AttemptTimelineEvent, TicketAttemptSelection } from "../data/attempt-types";
import { hasPendingImplementationInput } from "../data/implementation-input";
import type { TicketReviewRequests } from "../data/review-request-types";
import { readSessionHistory } from "../data/session-history";
import type { StoredTicket } from "../data/types";
import { isUnexpectedExit } from "./auto-build-resume";
import { isLiveSession } from "./auto-build-sessions";
import { WorkspaceUnavailableError, workspaceHead } from "./change-requests";
import { pullRequestRepairKey, pullRequestRepairReason, readPullRequestEvidence } from "./pull-request-evidence";

export interface WorkCandidate {
  id: string;
  ticket: string;
  title: string;
  action: "repair";
  workspaceId: string;
  expectedRun?: SessionRunSnapshot;
  expectedHeadSha: string;
  evidenceKey: string;
  reason: string;
}
export interface WorkObservation {
  ticket: string;
  workspaceId: string;
  owner: string;
  reason: string;
  nextAction: string;
  evidence?: unknown;
}
const noWork = () => ({ candidate: null as WorkCandidate | null, observation: null as WorkObservation | null });
const observation = (attempt: AttemptRecord, reason: string, nextAction: string, evidence?: unknown) => ({
  ...noWork(),
  observation: {
    ticket: attempt.ticketShorthand,
    workspaceId: attempt.workspaceId,
    owner: attempt.implementationSessionId,
    reason,
    nextAction,
    evidence,
  },
});
const candidate = (
  ticket: StoredTicket,
  attempt: AttemptRecord,
  reason: string,
  extra: Pick<WorkCandidate, "expectedHeadSha" | "evidenceKey">,
) => {
  const repair: WorkCandidate = {
    id: ticket.id,
    ticket: ticket.shorthand,
    title: ticket.title,
    workspaceId: attempt.workspaceId,
    action: "repair",
    reason,
    ...extra,
  };
  return { ...noWork(), candidate: repair };
};

const observeSubmittedWork = async (
  ctx: CommandContext,
  ticket: StoredTicket,
  attempt: AttemptRecord,
  events: AttemptTimelineEvent[],
) => {
  const revision = attempt.revisions.at(-1)!;
  const [head, pr] = await Promise.all([
    workspaceHead(ctx, attempt.workspaceId).catch((error: unknown) => {
      if (error instanceof WorkspaceUnavailableError) return error;
      throw error;
    }),
    readPullRequestEvidence(ctx, ticket, revision.headSha),
  ]);
  if (head instanceof WorkspaceUnavailableError)
    return observation(
      attempt,
      head.message,
      "Auto Build recovers the work in a fresh workspace when capacity allows.",
    );
  if (pr && "error" in pr) return observation(attempt, pr.error, "Restore access to inspect the current PR head.");
  let reason = pullRequestRepairReason(pr, revision.headSha);
  if (head !== revision.headSha)
    reason =
      "Workspace HEAD differs from the submitted revision. Validate and submit the correction with a saved report.";
  if (!reason)
    return observation(
      attempt,
      "A committed handoff is recorded.",
      "Follow the task's delivery requirements. No extra review is required.",
      pr,
    );
  const evidenceKey = pullRequestRepairKey(attempt.workspaceId, head, pr);
  if (events.some((event) => event.metadata.evidenceKey === evidenceKey))
    return observation(
      attempt,
      "Repair was already requested for this evidence.",
      "Inspect the current owner before requesting another repair.",
    );
  return candidate(ticket, attempt, reason, { expectedHeadSha: head, evidenceKey });
};

interface ObserveInput {
  requests: Map<string, TicketReviewRequests>;
  completedStatusIds: string[];
  events: AttemptTimelineEvent[];
  owned: boolean;
}

type Session = NonNullable<Awaited<ReturnType<CommandContext["sessions"]["get"]>>>;

const runSnapshot = (session: Session): SessionRunSnapshot => ({
  status: session.status!,
  startedAt: session.last_request_started ?? null,
  endedAt: session.last_request_ended ?? null,
});

// Unfinished work and one lost run resume through Auto Build resumptions. Submitted work needs PR and CI evidence.
const observeStoppedWork = async (
  ctx: CommandContext,
  ticket: StoredTicket,
  attempt: AttemptRecord,
  input: ObserveInput,
  session: Session,
) => {
  const stoppedAt = session.last_request_ended ?? session.updated_at ?? attempt.updatedAt;
  if (
    input.events.some(
      (event) =>
        event.type === "implementation_resumed" && event.sessionId === session.id && event.createdAt >= stoppedAt,
    )
  )
    return observation(
      attempt,
      "A follow-up is queued for the current owner.",
      "Wait for the owner to acknowledge and continue.",
    );
  if (session.status === "failed" && attempt.revisions.length)
    return observation(
      attempt,
      "The owner execution failed.",
      "Inspect the failure and resume explicitly to finish PR and CI work.",
      session.last_exit,
    );
  if (isUnexpectedExit(session))
    return attempt.implementationDisconnectRetries > 0
      ? observation(attempt, "Automatic recovery was already used.", "Inspect the stopped owner before resuming.")
      : observation(attempt, "Execution was lost.", "Auto Build resumes it once in the same conversation.");
  if (!attempt.revisions.length)
    return observation(
      attempt,
      "The session stopped before recording a committed handoff.",
      "Auto Build asks the owner to continue the task and record a revision.",
    );
  const result = await observeSubmittedWork(ctx, ticket, attempt, input.events);
  if (result.candidate) result.candidate.expectedRun = runSnapshot(session);
  return result;
};

const observeVariant = async (
  ctx: CommandContext,
  ticket: StoredTicket,
  attempt: AttemptRecord,
  input: ObserveInput,
) => {
  const session = await ctx.sessions.get(attempt.implementationSessionId);
  if (isLiveSession(session))
    return observation(attempt, "Execution is active.", "The current owner continues, including PR and CI work.");
  if (!input.owned)
    return observation(
      attempt,
      "Implementation variants need an explicit selection.",
      "Select the variant to advance.",
    );
  const competing = (await readSessionHistory(ctx.sessions, { workspaceId: attempt.workspaceId })).some(
    (other) => other.id !== session?.id && isLiveSession(other),
  );
  if (competing)
    return observation(
      attempt,
      "Another session is executing in this workspace.",
      "Wait for acknowledged handoff before resuming a writer.",
    );
  if (hasPendingImplementationInput(input.requests.get(ticket.id) ?? { requests: [], errors: [] }))
    return observation(attempt, "Implementation needs human input.", "Answer the open implementation request.");
  if (!session || session.last_exit?.cause === "user_stop")
    return observation(
      attempt,
      "A person stopped this execution.",
      "Resume explicitly after inspecting the stopped session.",
    );
  if (input.completedStatusIds.includes(ticket.statusId ?? "")) return noWork();
  return observeStoppedWork(ctx, ticket, attempt, input, session);
};

// Callers pass project history they already loaded, so observing many tickets reads it once.
export async function observeTicketWork(
  ctx: CommandContext,
  ticket: StoredTicket,
  input: {
    requests: Map<string, TicketReviewRequests>;
    completedStatusIds: string[];
    attempts: AttemptRecord[];
    retired: Set<string>;
    selections: TicketAttemptSelection[];
    events: AttemptTimelineEvent[];
  },
) {
  const { attempts, retired, selections, ...shared } = input;
  const candidates: WorkCandidate[] = [];
  const observations: WorkObservation[] = [];
  const variants = attempts.filter((attempt) => attempt.ticketId === ticket.id && !retired.has(attempt.workspaceId));
  const selected = selections.find((selection) => selection.ticketId === ticket.id);
  const chosen = selected ? variants.filter((attempt) => attempt.workspaceId === selected.workspaceId) : variants;
  for (const attempt of variants) {
    const result = await observeVariant(ctx, ticket, attempt, {
      ...shared,
      owned: chosen.length === 1 && chosen[0]?.workspaceId === attempt.workspaceId,
    });
    if (result.candidate) candidates.push(result.candidate);
    if (result.observation) observations.push(result.observation);
  }
  return { candidates, observations };
}
