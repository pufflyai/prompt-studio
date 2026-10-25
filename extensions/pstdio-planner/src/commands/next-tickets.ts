import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { type AttemptReadinessResult, findPendingPrerequisites } from "../data/attempt-readiness";
import { retiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptEventsCollection, attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { ticketsCollection } from "../data/collections";
import type { DependencyDeliveryReads } from "../data/dependency-deliveries";
import { resolveImplementationBase } from "../data/implementation-targets";
import { readTicketReviewRequests } from "../data/review-request-storage";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { observeTicketWork, type WorkObservation } from "./auto-build-observations";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";
import { canOfferStackRepair, readSelectedStackRepair } from "./next-stack-repair";
import type { NextTicketQuery } from "./next-ticket-query";
import { selectScopedWork } from "./next-ticket-scope";
import type { NextTicket, WaitingTicket } from "./next-ticket-types";
import { nextTicketWait } from "./next-ticket-wait";
import { nextWorkSnapshot } from "./next-work-snapshot";
import { readRecoveryBase, readRecoverySeed } from "./workspace-recovery";

function appendCandidate(
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
    next.push({ ...summary, action: "start", baseHeadSha: readiness.baseHeadSha });
  }
}

async function appendStackRepair(
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
        baseHeadSha: readiness.baseHeadSha,
        recoveryHeadSha: await readRecoverySeed(ctx, repair.attempt, readiness.baseHeadSha),
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
function appendObservedWork(
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

export async function readNextTickets(
  ctx: CommandContext,
  mode: AutoBuildMode,
  input: NextTicketQuery & { base?: string; limit?: number } = {},
  scope?: NextTicketQuery[],
) {
  const [plan, attempts, tickets, resumptions, capacity, assignments, requests, events, selections, workflow] =
    await Promise.all([
      readPlanCommand.run(ctx, {}),
      listAttempts(ctx.storage),
      ticketsCollection(ctx).list(),
      readAutoBuildResumptions(ctx),
      readImplementationCapacity(ctx),
      readAutoBuildAssignments(ctx),
      readTicketReviewRequests(ctx.storage),
      attemptEventsCollection(ctx.storage).list(),
      attemptSelectionsCollection(ctx.storage).list(),
      readWorkflowStatuses(ctx).then(usableWorkflowStatuses),
    ]);
  const retired = retiredWorkspaceIds(events);
  const byRef = new Map(
    tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const started = new Set(
    attempts.filter(({ workspaceId }) => !retired.has(workspaceId)).map(({ ticketId }) => ticketId),
  );
  const { selected, scoped, completed, configurationError } = await selectScopedWork(ctx, {
    plan,
    tickets,
    mode,
    query: input,
    scope,
    completedStatusIds: workflow.completedStatusIds,
    started,
  });
  const next: NextTicket[] = [];
  const waiting: WaitingTicket[] = [];
  const observations: WorkObservation[] = [];
  // Share GitHub reads within this query; dispatch rechecks create a fresh query.
  const deliveryReads: DependencyDeliveryReads = new Map();
  let base = input.base;
  const limit = input.limit ?? Infinity;
  for (const row of selected) {
    if (next.length >= limit) break;
    const summary = { id: row.id, ticket: row.shorthand, title: row.title };
    const pending = findPendingPrerequisites(byRef.get(row.id)!, byRef, requests, mode.requireMergedDependencies);
    const wait = nextTicketWait(row, {
      pending,
      assigned: assignments.assigned.has(row.id),
      attempts: attempts.filter(({ ticketId, workspaceId }) => ticketId === row.id && !retired.has(workspaceId)),
      resumable: resumptions.has(row.id),
      answeredInput: Boolean(resumptions.get(row.id)?.requests.length),
      blockedStatusIds: workflow.blockedStatusIds,
      capacity,
    });
    if (
      canOfferStackRepair(wait?.reason, resumptions.has(row.id), capacity) &&
      (await appendStackRepair(
        ctx,
        summary,
        attempts,
        selections,
        next,
        waiting,
        mode,
        deliveryReads,
        retired,
        input.base,
      ))
    )
      continue;
    if (wait?.reason === "existing-attempt") {
      const work = await observeTicketWork(ctx, byId.get(row.id)!, {
        requests,
        completedStatusIds: workflow.completedStatusIds,
        attempts,
        retired,
        selections,
        events,
      });
      observations.push(...work.observations);
      appendObservedWork(work, { ...summary, ...wait }, capacity, next, waiting);
      continue;
    }
    if (wait) {
      waiting.push({ ...summary, ...wait });
      continue;
    }
    const resumption = resumptions.get(row.id);
    const recordedBase =
      resumption && attempts.find(({ workspaceId }) => workspaceId === resumption.workspaceId)?.base.headSha;
    if (!recordedBase) base ??= await resolveImplementationBase(ctx, await ctx.settings.all());
    const { readiness } = await loadAttemptReadiness(
      ctx,
      row.id,
      { base: recordedBase ?? base, requireMergedDependencies: mode.requireMergedDependencies },
      deliveryReads,
    );
    appendCandidate(summary, readiness, resumptions.has(row.id), next, waiting);
  }
  const state = await nextWorkSnapshot(ctx, {
    revision: mode.revision,
    tickets,
    rows: selected,
    attempts,
    next,
    waiting,
    capacity,
  });
  return {
    tickets: next,
    waiting,
    capacity,
    completed,
    matchingTicketCount: selected.length,
    reviewRequests: scoped.flatMap((row) => row.requests.filter((request) => request.state === "open")),
    requestErrors: scoped.flatMap((row) => row.requestErrors),
    observations,
    configurationError,
    ...state,
  };
}

export const nextTicketsCommand = defineCommand({
  id: "next-tickets",
  title: "Read next tickets",
  cli: {
    globalAliases: [["tickets", "next"]],
    description: "Query launchable tickets and waiting reasons using current Auto Build rules.",
    examples: ["pst tickets next --track Workbench", "pst tickets next --status Todo --tags High"],
  },
  params: {
    track: params.text(),
    status: params.text(),
    tags: params.list(),
    parent: params.text(),
    base: params.text({ label: "Root target branch" }),
  },
  async run(ctx, input) {
    const mode = await readAutoBuildMode(ctx);
    const { tickets, waiting, capacity } = await readNextTickets(ctx, mode, input);
    return { enabled: mode.enabled, revision: mode.revision, tickets, waiting, capacity };
  },
});
