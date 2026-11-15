import type { CommandContext, StorageQueryRecord } from "@pstdio/sdk/extensions";
import { readTicketAttempts, readWorkspaceEvents } from "../data/attempt-queries";
import { findPendingPrerequisites } from "../data/attempt-readiness";
import { retiredWorkspaceIds } from "../data/attempt-retirement";
import { attemptSelectionsCollection } from "../data/attempt-storage";
import type { AutoBuildMode } from "../data/auto-build-mode";
import type { DependencyDeliveryReads } from "../data/dependency-deliveries";
import { findStoredTicket } from "../data/resolve";
import { readTicketDependencyClosure } from "../data/ticket-dependency-reads";
import { readTicketInputStates } from "../data/ticket-input-state";
import { ticketQuerySummary } from "../data/ticket-query-summary";
import type { Ticket } from "../data/types";
import type { WorkflowStatusSelections } from "../data/workflow-statuses";
import type { WorkObservation } from "./auto-build-observations";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";
import { appendNextTicketOutcome } from "./next-ticket-actions";
import type { NextTicket, WaitingTicket } from "./next-ticket-types";
import { nextDependencySnapshot } from "./next-work-snapshot";
export const readNextTicketEvidence = async (ctx: CommandContext, ticket: Ticket, mode: AutoBuildMode) => {
  const closure = await readTicketDependencyClosure(ctx, ticket.id, ticket);
  const [attempts, requests, assignment, resumption, selected] = await Promise.all([
    readTicketAttempts(ctx.storage, [ticket.id]),
    readTicketInputStates(
      ctx.storage,
      closure.tickets.map(({ id }) => id),
    ),
    readAutoBuildAssignments(ctx, [ticket.id]),
    readAutoBuildResumptions(ctx, [ticket.id]),
    attemptSelectionsCollection(ctx.storage).get(ticket.id),
  ]);
  const events = attempts.length
    ? await readWorkspaceEvents(
        ctx.storage,
        attempts.map(({ workspaceId }) => workspaceId),
      )
    : [];
  const retired = retiredWorkspaceIds(events);
  const selections = selected ? [selected] : [];
  const byRef = new Map(
    closure.tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const pending = findPendingPrerequisites(ticket, byRef, requests, mode.requireMergedDependencies);

  return { closure, attempts, requests, assignment, resumption, events, retired, selections, pending };
};

export interface NextPageState {
  base?: string;
  offset: number;
  examined: number;
  progressAt: number;
  dependencies: string;
  more: boolean;
}
export const visitNextTicketPage = async (
  ctx: CommandContext,
  records: StorageQueryRecord[],
  state: NextPageState,
  {
    mode,
    workflow,
    capacity,
    next,
    waiting,
    observations,
    deliveryReads,
    limit,
    matchingTicketCount,
    requestedBase,
  }: {
    mode: AutoBuildMode;
    workflow: WorkflowStatusSelections;
    capacity: { running: number; limit: number };
    next: NextTicket[];
    waiting: WaitingTicket[];
    observations: WorkObservation[];
    deliveryReads: DependencyDeliveryReads;
    limit: number;
    matchingTicketCount: number;
    requestedBase?: string;
  },
) => {
  for (const record of records) {
    const summary = ticketQuerySummary(record.fields)!;
    const row = { ...summary, gate: typeof record.fields.gate === "string" ? (true as const) : undefined };
    const ticket = await findStoredTicket(ctx, row.id);
    state.offset++;
    state.examined++;
    state.more = state.offset < matchingTicketCount;
    if (!ticket) continue;
    state.progressAt = Math.max(state.progressAt, Date.parse(ticket.updatedAt) || 0);
    const evidence = await readNextTicketEvidence(ctx, ticket, mode);
    const { attempts } = evidence;
    state.dependencies = await nextDependencySnapshot(ctx, state.dependencies, evidence);
    for (const attempt of attempts) state.progressAt = Math.max(state.progressAt, Date.parse(attempt.updatedAt) || 0);
    state.base = await appendNextTicketOutcome(ctx, {
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
      base: state.base,
      requestedBase: requestedBase,
    });
    // Wake checks may search past waiting pages; keep only a bounded explanation window.
    if (waiting.length > 100) waiting.length = 100;
    if (observations.length > 100) observations.length = 100;
    if (next.length >= limit) break;
  }
};
