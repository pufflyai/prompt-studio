import type { CommandContext, SessionRunSnapshot } from "@pstdio/sdk/extensions";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptEventsCollection, attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import type { AttemptRecord, AttemptTimelineEvent } from "../data/attempt-types";
import { hasPendingImplementationInput } from "../data/implementation-input";
import type { TicketReviewRequests } from "../data/review-request-types";
import type { StoredTicket } from "../data/types";
import { isLiveSession } from "./auto-build-sessions";
import { workspaceHead } from "./change-requests";
import { pullRequestRepairReason, readPullRequestEvidence } from "./pull-request-evidence";
import { readDependencyHeads } from "./stack-validation";

export interface WorkCandidate {
  id: string;
  ticket: string;
  title: string;
  action: "start" | "resume" | "recover" | "repair";
  expectedRun?: SessionRunSnapshot;
  workspaceId?: string;
  baseHeadSha?: string;
  expectedHeadSha?: string;
  evidenceKey?: string;
  reason?: string;
  integrationHeads?: { workspaceId: string; headSha: string }[];
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
  action: WorkCandidate["action"],
  reason: string,
  extra: Partial<WorkCandidate> = {},
) => ({
  ...noWork(),
  candidate: {
    id: ticket.id,
    ticket: ticket.shorthand,
    title: ticket.title,
    workspaceId: attempt.workspaceId,
    action,
    reason,
    ...extra,
  },
});
export const isUnexpectedExit = (session: Awaited<ReturnType<CommandContext["sessions"]["get"]>>) =>
  session?.status === "disconnected" ||
  ["request_aborted", "worker_lost", "host_shutdown"].includes(session?.last_exit?.cause ?? "");

const dependencyRepair = async (ctx: CommandContext, ticket: StoredTicket, head: string) => {
  try {
    const dependencies = await readDependencyHeads(ctx, ticket.id);
    const home = await ctx.workspaces.getDefault();
    for (const dependency of dependencies) {
      const result = await ctx.process.run({
        command: ["git", "-C", home!.root_path!, "merge-base", "--is-ancestor", dependency.headSha, head],
      });
      if (result.exitCode > 1) throw new Error(result.stderr.trim() || "Dependency ancestry is unavailable.");
      if (result.exitCode === 1)
        return {
          dependencies,
          blocker: null,
          reason: `Dependency advanced to ${dependency.headSha}. Integrate current prerequisites, validate, and record the integration with update-stack before resubmitting. Preserve ticket prerequisite instructions.`,
        };
    }
    return { dependencies, blocker: null, reason: "" };
  } catch (error) {
    return { dependencies: [], reason: "", blocker: error instanceof Error ? error.message : String(error) };
  }
};

const observeSubmittedWork = async (
  ctx: CommandContext,
  ticket: StoredTicket,
  attempt: AttemptRecord,
  events: AttemptTimelineEvent[],
) => {
  const revision = attempt.revisions.at(-1)!;
  const [head, pr] = await Promise.all([
    workspaceHead(ctx, attempt.workspaceId),
    readPullRequestEvidence(ctx, ticket, revision.headSha),
  ]);
  if (pr && "error" in pr) return observation(attempt, pr.error, "Restore access to inspect the current PR head.");
  const dependency = await dependencyRepair(ctx, ticket, head);
  if (dependency.blocker)
    return observation(attempt, dependency.blocker, "Resolve the dependency evidence before repair.");
  let reason = pullRequestRepairReason(pr, revision.headSha) || dependency.reason;
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
  const evidenceKey = `repair:${attempt.workspaceId}:${head}:${JSON.stringify({ pr, dependencyHeads: dependency.dependencies })}`;
  if (events.some((event) => event.metadata.evidenceKey === evidenceKey))
    return observation(
      attempt,
      "Repair was already requested for this evidence.",
      "Inspect the current owner before requesting another repair.",
    );
  return candidate(ticket, attempt, "repair", reason, { expectedHeadSha: head, evidenceKey });
};

interface ObserveInput {
  requests: Map<string, TicketReviewRequests>;
  completedStatusIds: string[];
  events: AttemptTimelineEvent[];
  owned: boolean;
}
const observeStoppedWork = async (
  ctx: CommandContext,
  ticket: StoredTicket,
  attempt: AttemptRecord,
  input: ObserveInput,
  session: NonNullable<Awaited<ReturnType<CommandContext["sessions"]["get"]>>>,
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
  if (session.status === "failed")
    return observation(
      attempt,
      "The owner execution failed.",
      "Inspect the failure and resume explicitly to finish PR and CI work.",
      session.last_exit,
    );
  if (attempt.revisions.length) {
    const result = await observeSubmittedWork(ctx, ticket, attempt, input.events);
    if (result.candidate)
      result.candidate.expectedRun = {
        status: session.status!,
        startedAt: session.last_request_started ?? null,
        endedAt: session.last_request_ended ?? null,
      };
    return result;
  }
  const evidenceKey = `unfinished:${attempt.workspaceId}:${stoppedAt}`;
  return candidate(
    ticket,
    attempt,
    "repair",
    "The session stopped before recording a committed handoff. Continue the task and record the required revision and report.",
    {
      expectedRun: {
        status: session.status!,
        startedAt: session.last_request_started ?? null,
        endedAt: session.last_request_ended ?? null,
      },
      evidenceKey,
      expectedHeadSha: await workspaceHead(ctx, attempt.workspaceId),
    },
  );
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
  const competing = (await ctx.sessions.listByWorkspace(attempt.workspaceId)).some(
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
  if (!session || (session.status === "cancelled" && !isUnexpectedExit(session)))
    return observation(
      attempt,
      "Execution is stopped; cancellation intent is not recoverable automatically.",
      "Resume explicitly after inspecting the stopped session.",
    );
  if (input.completedStatusIds.includes(ticket.statusId ?? "")) return noWork();
  if (isUnexpectedExit(session)) {
    if (attempt.implementationDisconnectRetries > 0)
      return observation(attempt, "Automatic recovery was already used.", "Inspect the stopped owner before resuming.");
    return candidate(ticket, attempt, "recover", "Execution was lost; resume once in the same conversation.", {
      expectedRun: {
        status: session.status!,
        startedAt: session.last_request_started ?? null,
        endedAt: session.last_request_ended ?? null,
      },
    });
  }
  return observeStoppedWork(ctx, ticket, attempt, input, session);
};

export async function observeAttemptWork(
  ctx: CommandContext,
  input: {
    tickets: StoredTicket[];
    allTickets: StoredTicket[];
    requests: Map<string, TicketReviewRequests>;
    completedStatusIds: string[];
  },
) {
  const [attempts, retired, selections, events] = await Promise.all([
    listAttempts(ctx.storage),
    readRetiredWorkspaceIds(ctx.storage),
    attemptSelectionsCollection(ctx.storage).list(),
    attemptEventsCollection(ctx.storage).list(),
  ]);
  const candidates: WorkCandidate[] = [];
  const observations: WorkObservation[] = [];
  for (const ticket of input.tickets) {
    const variants = attempts.filter((attempt) => attempt.ticketId === ticket.id && !retired.has(attempt.workspaceId));
    const selected = selections.find((selection) => selection.ticketId === ticket.id);
    const chosen = selected ? variants.filter((attempt) => attempt.workspaceId === selected.workspaceId) : variants;
    for (const attempt of variants) {
      const result = await observeVariant(ctx, ticket, attempt, {
        ...input,
        events,
        owned: chosen.length === 1 && chosen[0]?.workspaceId === attempt.workspaceId,
      });
      if (result.candidate) candidates.push(result.candidate);
      if (result.observation) observations.push(result.observation);
    }
  }
  return { candidates, observations };
}
