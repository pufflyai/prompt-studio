import type { CommandContext } from "@pstdio/sdk/extensions";
import { attemptId } from "../data/attempt-identity";
import type { AttemptReadinessResult } from "../data/attempt-readiness";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import type { AutoBuildMode } from "../data/auto-build-mode";
import type { DependencyDeliveryReads } from "../data/dependency-deliveries";
import { resolveImplementationBase } from "../data/implementation-targets";
import type { GithubReads } from "../data/pull-request-resources";
import type { ticketQuerySummary } from "../data/ticket-query-summary";
import type { Ticket } from "../data/types";
import { loadAttemptReadiness } from "./attempt-readiness";
import type { WorkObservation } from "./auto-build-observations";
import { observeTicketWork } from "./auto-build-observations";
import { canOfferStackRepair, readSelectedStackRepair } from "./next-stack-repair";
import type { readNextTicketEvidence } from "./next-ticket-evidence";
import type { NextTicket, WaitingTicket } from "./next-ticket-types";
import { nextTicketWait } from "./next-ticket-wait";
import { readRecoveryBase, readRecoverySeed } from "./workspace-recovery";

export function appendCandidate(
  summary: Pick<NextTicket, "id" | "ticket" | "title">,
  readiness: AttemptReadinessResult,
  resumable: boolean,
  next: NextTicket[],
  waiting: WaitingTicket[],
) {
  if (readiness.decision === "wait") {
    waiting.push({ ...summary, reason: readiness.reason, dependencyIds: readiness.dependencyIds });
  } else if (resumable) {
    next.push({ ...summary, action: "resume" });
  } else {
    next.push({ ...summary, action: "start", baseHeadSha: readiness.baseHeadSha ?? undefined });
  }
}

export async function appendStackRepair(
  ctx: CommandContext,
  summary: Pick<NextTicket, "id" | "ticket" | "title">,
  attempts: AttemptRecord[],
  selections: TicketAttemptSelection[],
  next: NextTicket[],
  waiting: WaitingTicket[],
  mode: AutoBuildMode,
  deliveryReads: DependencyDeliveryReads,
  retired: Set<string>,
  base?: string,
) {
  const repair = await readSelectedStackRepair(ctx, summary.id, attempts, selections, retired, mode);
  if (!repair) return false;
  if ("unavailableWorkspaceId" in repair) {
    const recoveryBase = await readRecoveryBase(ctx, repair.attempt, base);
    const { readiness } = await loadAttemptReadiness(
      ctx,
      summary.id,
      { base: recoveryBase, requireMergedDependencies: mode.requireMergedDependencies },
      deliveryReads,
    );
    if (readiness.decision === "wait")
      waiting.push({ ...summary, reason: readiness.reason, dependencyIds: readiness.dependencyIds });
    else
      next.push({
        ...summary,
        action: "recover-workspace",
        recoveryBaseSha: recoveryBase,
        workspaceId: repair.unavailableWorkspaceId,
        baseHeadSha: readiness.baseHeadSha ?? undefined,
        recoveryHeadSha: await readRecoverySeed(ctx, repair.attempt, readiness.baseHeadSha!),
        detail: repair.detail,
      });
  } else {
    next.push({
      ...summary,
      action: "update-stack",
      workspaceId: repair.workspaceId,
      baseHeadSha: repair.base.headSha,
    });
  }
  return true;
}

// A repair for submitted work runs when capacity allows; otherwise the observations explain the wait.
export function appendObservedWork(
  work: Awaited<ReturnType<typeof observeTicketWork>>,
  wait: WaitingTicket,
  capacity: { running: number; limit: number },
  next: NextTicket[],
  waiting: WaitingTicket[],
) {
  const [repair] = work.candidates;
  if (repair && capacity.running < capacity.limit) {
    const { reason, ...action } = repair;
    next.push({ ...action, id: wait.id, ticket: wait.ticket, title: wait.title, detail: reason });
    return;
  }
  const detail = work.observations.map(({ reason, nextAction }) => `${reason} ${nextAction}`).join(" ");
  waiting.push({ ...wait, ...(detail ? { detail } : {}) });
}

interface NextOutcomeInput {
  row: NonNullable<ReturnType<typeof ticketQuerySummary>> & { gate?: true };
  ticket: Ticket;
  evidence: Awaited<ReturnType<typeof readNextTicketEvidence>>;
  mode: AutoBuildMode;
  workflow: { completedStatusIds: string[] };
  capacity: { running: number; limit: number };
  next: NextTicket[];
  waiting: WaitingTicket[];
  observations: WorkObservation[];
  deliveryReads: DependencyDeliveryReads;
  base?: string;
  requestedBase?: string;
  pullRequestReads: GithubReads;
}

export const appendNextTicketOutcome = async (
  ctx: CommandContext,
  {
    row,
    ticket,
    evidence,
    mode,
    workflow,
    capacity,
    next,
    waiting,
    observations,
    deliveryReads,
    base,
    requestedBase,
    pullRequestReads,
  }: NextOutcomeInput,
) => {
  const { attempts, requests, assignment, resumption, events, retired, selections, pending } = evidence;
  const wait = nextTicketWait(row, {
    pending,
    assigned: assignment.assigned.has(ticket.id),
    attempts: attempts.filter((attempt) => !retired.has(attemptId(attempt))),
    resumable: resumption.has(ticket.id),
    capacity,
  });
  const display = { id: row.id, ticket: row.shorthand, title: row.title };
  if (
    canOfferStackRepair(wait?.reason, resumption.has(row.id), capacity) &&
    (await appendStackRepair(
      ctx,
      display,
      attempts,
      selections,
      next,
      waiting,
      mode,
      deliveryReads,
      retired,
      requestedBase,
    ))
  ) {
    // The selected stack repair already describes this candidate.
  } else if (wait?.reason === "existing-attempt") {
    const work = await observeTicketWork(ctx, ticket, {
      requests,
      completedStatusIds: workflow.completedStatusIds,
      attempts,
      retired,
      selections,
      events,
      pullRequestReads,
    });
    observations.push(...work.observations);
    appendObservedWork(work, { ...display, ...wait }, capacity, next, waiting);
  } else if (wait) waiting.push({ ...display, ...wait });
  else {
    const continuation = resumption.get(ticket.id);
    const recordedBase =
      continuation &&
      attempts.find((attempt) => attemptId(attempt) === (continuation.attemptId ?? continuation.workspaceId))?.base
        ?.headSha;
    if (!recordedBase) base ??= await resolveImplementationBase(ctx, await ctx.settings.all());
    const { readiness } = await loadAttemptReadiness(
      ctx,
      ticket.id,
      { base: recordedBase ?? base, requireMergedDependencies: mode.requireMergedDependencies },
      deliveryReads,
    );
    appendCandidate(display, readiness, resumption.has(ticket.id), next, waiting);
  }

  return base;
};
