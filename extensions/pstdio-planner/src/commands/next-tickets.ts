import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import { type AttemptReadinessResult, findPendingPrerequisites } from "../data/attempt-readiness";
import { attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import { usableAutoBuildIgnore } from "../data/auto-build-ignore";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { ticketsCollection } from "../data/collections";
import type { DependencyDeliveryReads } from "../data/dependency-deliveries";
import { resolveImplementationBase } from "../data/implementation-targets";
import { readTicketReviewRequests } from "../data/review-request-storage";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";
import { canOfferStackRepair, readSelectedStackRepair } from "./next-stack-repair";
import { type NextTicketQuery, selectNextTicketRows, selectNextTicketScopeRows } from "./next-ticket-query";
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
  base?: string,
) {
  const repair = await readSelectedStackRepair(ctx, summary.id, attempts, selections);
  if (!repair) return false;
  if ("unavailableWorkspaceId" in repair) {
    const recoveryBase = await readRecoveryBase(ctx, repair.attempt, base);
    const { readiness } = await loadAttemptReadiness(
      ctx,
      summary.id,
      { base: recoveryBase, dependencyReview: mode.blockOnReview ? "approved" : "submitted" },
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

export async function readNextTickets(
  ctx: CommandContext,
  mode: AutoBuildMode,
  input: NextTicketQuery & { base?: string; limit?: number } = {},
  scope?: NextTicketQuery[],
) {
  const [plan, attempts, tickets, resumptions, capacity, assignments, requests] = await Promise.all([
    readPlanCommand.run(ctx, {}),
    listAttempts(ctx.storage),
    ticketsCollection(ctx.storage).list(),
    readAutoBuildResumptions(ctx),
    readImplementationCapacity(ctx),
    readAutoBuildAssignments(ctx),
    readTicketReviewRequests(ctx.storage),
  ]);
  const byRef = new Map(
    tickets.flatMap((ticket) => [
      [ticket.id, ticket],
      [ticket.shorthand, ticket],
    ]),
  );
  const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const selections = await attemptSelectionsCollection(ctx.storage).list();
  const query = timelineQueryData(plan, (_key, fallback) => fallback ?? _key);
  const ignore = usableAutoBuildIgnore(mode.ignore, query.attributes);
  const ignored = new Set(ignore ? filterRowsByView(query.rows, ignore, query.attributes).map(({ id }) => id) : []);
  const supervisor = await readAutoBuildSupervisor(ctx);
  const queries = scope ?? (supervisor.scope?.revision === mode.revision ? supervisor.scope.queries : [{}]);
  const scoped = await selectNextTicketScopeRows(ctx, plan, tickets, queries);
  const scopedIds = new Set(scoped.map(({ id }) => id));
  const selected = (await selectNextTicketRows(ctx, plan, tickets, input)).filter(
    ({ id }) => scopedIds.has(id) && !ignored.has(id) && !byId.get(id)?.draft,
  );
  const next: NextTicket[] = [];
  const waiting: WaitingTicket[] = [];
  // Share GitHub reads within this query; dispatch rechecks create a fresh query.
  const deliveryReads: DependencyDeliveryReads = new Map();
  let base = input.base;
  const limit = input.limit ?? Infinity;
  for (const row of selected) {
    if (next.length >= limit) break;
    const summary = { id: row.id, ticket: row.shorthand, title: row.title };
    const pending = findPendingPrerequisites(byRef.get(row.id)!, byRef, requests);
    const wait = nextTicketWait(row, {
      pending,
      assigned: assignments.assigned.has(row.id),
      attempts: attempts.filter(({ ticketId, state }) => ticketId === row.id && state !== "abandoned"),
      resumable: resumptions.has(row.id),
      capacity,
    });
    if (
      canOfferStackRepair(wait?.reason, resumptions.has(row.id), capacity) &&
      (await appendStackRepair(ctx, summary, attempts, selections, next, waiting, mode, deliveryReads, input.base))
    )
      continue;
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
      { base: recordedBase ?? base, dependencyReview: mode.blockOnReview ? "approved" : "submitted" },
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
  return { tickets: next, waiting, capacity, ...state };
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
