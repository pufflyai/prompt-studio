import { type CommandContext, defineCommand } from "@pstdio/sdk/extensions";
import { findPendingPrerequisites } from "../data/attempt-readiness";
import { readRetiredWorkspaceIds } from "../data/attempt-retirement";
import { listAttempts } from "../data/attempt-storage";
import { readAutoBuildTicketFilters } from "../data/auto-build-filter";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { ticketsCollection } from "../data/collections";
import { resolveImplementationBase } from "../data/implementation-targets";
import { readTicketReviewRequests } from "../data/review-request-storage";
import { normalizeTicketDependencies } from "../data/ticket-dependencies";
import type { StoredTicket } from "../data/types";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { observeAttemptWork, type WorkCandidate } from "./auto-build-observations";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";

const relevantTicketIds = (scope: string[] | null, tickets: StoredTicket[]) => {
  const byRef = new Map(
    tickets.flatMap((t) => [
      [t.id, t],
      [t.shorthand, t],
    ]),
  );
  const pending = [...(scope ?? [])];
  const ids = new Set<string>();
  while (pending.length) {
    const ticket = byRef.get(pending.pop()!);
    if (!ticket || ids.has(ticket.id)) continue;
    ids.add(ticket.id);
    pending.push(...normalizeTicketDependencies(ticket.dependsOn));
  }
  return ids;
};

const scopeTickets = (tickets: StoredTicket[], eligible: Set<string>, ignored: Set<string>, completed: string[]) =>
  tickets
    .filter(
      (ticket) =>
        !ticket.archived &&
        !ticket.draft &&
        !completed.includes(ticket.statusId ?? "") &&
        eligible.has(ticket.id) &&
        !ignored.has(ticket.id),
    )
    .map(({ id, shorthand, title, tagIds, dependsOn }) => ({ id, ticket: shorthand, title, tagIds, dependsOn }));

const completedScope = (tickets: StoredTicket[], scope: string[] | null, completed: string[]) => {
  const completedIds = new Set(
    tickets.filter((ticket) => completed.includes(ticket.statusId ?? "")).map((ticket) => ticket.id),
  );
  return scope?.every((id) => completedIds.has(id)) ?? false;
};

export async function readAutoBuildCandidates(ctx: CommandContext, mode: AutoBuildMode) {
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
  const query = timelineQueryData(plan, (_key, fallback) => fallback ?? _key);
  const { eligible, ignored, configurationError } = readAutoBuildTicketFilters(
    mode.eligible,
    mode.ignore,
    query.rows,
    query.attributes,
  );
  const retired = await readRetiredWorkspaceIds(ctx.storage);
  const attempted = new Set(
    attempts.filter(({ workspaceId }) => !retired.has(workspaceId)).map(({ ticketId }) => ticketId),
  );
  const workflowRead = await readWorkflowStatuses(ctx);
  const workflow = usableWorkflowStatuses(workflowRead);
  const candidates: WorkCandidate[] = [];
  const blockedTickets: string[] = [];
  const scoped =
    mode.scopeTicketIds === null ? [] : tickets.filter((ticket) => mode.scopeTicketIds!.includes(ticket.id));
  const work = await observeAttemptWork(ctx, {
    tickets: scoped,
    allTickets: tickets,
    requests,
    completedStatusIds: workflow.completedStatusIds,
  });
  candidates.push(...work.candidates.filter((candidate) => !resumptions.has(candidate.id)));
  const settings = await ctx.settings.all();
  const pending = plan.sections
    .flatMap(({ rows }) => rows)
    .filter(
      (row) =>
        !ignored.has(row.id) &&
        mode.scopeTicketIds !== null &&
        mode.scopeTicketIds.includes(row.id) &&
        !workflow.completedStatusIds.includes(row.status?.id ?? "") &&
        (resumptions.has(row.id) || (!configurationError && eligible.has(row.id))) &&
        !tickets.find(({ id }) => id === row.id)?.draft &&
        !assignments.assigned.has(row.id),
    );
  const rows = pending.filter((row) => {
    const blocked =
      row.gate ||
      (!resumptions.has(row.id) && (row.blockedReason || workflow.blockedStatusIds.includes(row.status?.id ?? ""))) ||
      findPendingPrerequisites(byRef.get(row.id)!, byRef, requests, mode.requireMergedDependencies).length > 0;
    if (blocked) blockedTickets.push(row.shorthand);
    return !blocked && (!attempted.has(row.id) || resumptions.has(row.id));
  });
  if (capacity.running < capacity.limit && rows.length) {
    const base = await resolveImplementationBase(ctx, settings);
    for (const row of rows) {
      if (resumptions.has(row.id)) {
        candidates.push({ id: row.id, ticket: row.shorthand, title: row.title, action: "resume" });
      } else {
        const { readiness } = await loadAttemptReadiness(ctx, row.id, {
          base,
          dependencyReview: "submitted",
          requireMergedDependencies: mode.requireMergedDependencies,
        });
        if (readiness.decision === "ready")
          candidates.push({
            id: row.id,
            ticket: row.shorthand,
            title: row.title,
            action: "start",
            baseHeadSha: readiness.baseHeadSha,
          });
        else if (readiness.reason === "divergent-dependency-attempts")
          candidates.push({
            id: row.id,
            ticket: row.shorthand,
            title: row.title,
            action: "start",
            baseHeadSha: readiness.baseHeadSha,
            integrationHeads: readiness.integrationHeads,
            reason: "Integrate and validate the independent prerequisite commits before implementation.",
          });
        else blockedTickets.push(row.shorthand);
      }
    }
  }
  // Ticket bodies and review answers matter even when the set of candidates stays the same.
  const relevant = relevantTicketIds(mode.scopeTicketIds, tickets);
  const fingerprint = JSON.stringify({
    revision: mode.revision,
    tickets: tickets.filter((ticket) => relevant.has(ticket.id)).sort((a, b) => a.id.localeCompare(b.id)),
    rows: pending,
    attempts: attempts.filter((attempt) => relevant.has(attempt.ticketId)),
    observations: work.observations,
    requests: [...requests].filter(([id]) => relevant.has(id)),
    candidates,
    capacity,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const snapshot = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return {
    candidates,
    capacity,
    snapshot,
    blockedTickets,
    configurationError,
    observations: work.observations,
    completed: completedScope(scoped, mode.scopeTicketIds, workflow.completedStatusIds),
    scopeUnresolved: mode.scopeTicketIds === null,
    scopeOptions:
      mode.scopeTicketIds === null && !configurationError
        ? scopeTickets(tickets, eligible, ignored, workflow.completedStatusIds)
        : [],
  };
}

export const autoBuildCandidatesCommand = defineCommand({
  id: "auto-build.candidates",
  title: "Read Auto Build candidates",
  cli: true,
  async run(ctx) {
    const mode = await readAutoBuildMode(ctx);
    return { enabled: mode.enabled, revision: mode.revision, ...(await readAutoBuildCandidates(ctx, mode)) };
  },
});
