import { type CommandContext, defineCommand, params } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import { findPendingPrerequisites } from "../data/attempt-readiness";
import { attemptSelectionsCollection, listAttempts } from "../data/attempt-storage";
import { usableAutoBuildIgnore } from "../data/auto-build-ignore";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { ticketsCollection } from "../data/collections";
import { resolveImplementationBase } from "../data/implementation-targets";
import { readTicketReviewRequests } from "../data/review-request-storage";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";
import { canOfferStackRepair, readSelectedStackRepair } from "./next-stack-repair";
import { type NextTicketQuery, selectNextTicketRows } from "./next-ticket-query";
import type { NextTicket, WaitingTicket } from "./next-ticket-types";
import { nextTicketWait } from "./next-ticket-wait";

export async function readNextTickets(ctx: CommandContext, mode: AutoBuildMode, input: NextTicketQuery = {}) {
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
  const selected = await selectNextTicketRows(ctx, plan, tickets, input);
  const next: NextTicket[] = [];
  const waiting: WaitingTicket[] = [];
  let base: string | undefined;
  for (const row of selected) {
    if (ignored.has(row.id) || byId.get(row.id)?.draft) continue;
    const summary = { id: row.id, ticket: row.shorthand, title: row.title };
    const pending = findPendingPrerequisites(byRef.get(row.id)!, byRef, requests);
    const wait = nextTicketWait(row, {
      pending,
      assigned: assignments.assigned.has(row.id),
      attempts: attempts.filter(({ ticketId, state }) => ticketId === row.id && state !== "abandoned"),
      resumable: resumptions.has(row.id),
      capacity,
    });
    if (canOfferStackRepair(wait?.reason, resumptions.has(row.id), capacity)) {
      const repair = await readSelectedStackRepair(ctx, row.id, attempts, selections);
      if (repair) {
        next.push({
          ...summary,
          action: "update-stack",
          workspaceId: repair.workspaceId,
          baseHeadSha: repair.base.headSha,
        });
        continue;
      }
    }
    if (wait) {
      waiting.push({ ...summary, ...wait });
      continue;
    }
    base ??= await resolveImplementationBase(ctx, await ctx.settings.all());
    const { readiness } = await loadAttemptReadiness(ctx, row.id, {
      base,
      dependencyReview: mode.blockOnReview ? "approved" : "submitted",
    });
    if (readiness.decision === "wait") {
      waiting.push({ ...summary, reason: readiness.reason, dependencyIds: readiness.dependencyIds });
    } else if (resumptions.has(row.id)) {
      next.push({ ...summary, action: "resume" });
    } else {
      next.push({ ...summary, action: "start", baseHeadSha: readiness.baseHeadSha });
    }
  }
  // Include bodies and answers so an edit can wake the supervisor even when readiness stays the same.
  const fingerprint = JSON.stringify({
    revision: mode.revision,
    tickets: tickets.sort((a, b) => a.id.localeCompare(b.id)),
    rows: selected,
    next,
    waiting,
    capacity,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const snapshot = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { tickets: next, waiting, capacity, snapshot };
}

export const nextTicketsCommand = defineCommand({
  id: "next-tickets",
  title: "Read next tickets",
  cli: {
    globalAliases: [["tickets", "next"]],
    description: "Query launchable tickets and waiting reasons using current Auto Build rules.",
    examples: ["pst tickets next --track Workbench", "pst tickets next --status Todo --tags High"],
  },
  params: { track: params.text(), status: params.text(), tags: params.list(), parent: params.text() },
  async run(ctx, input) {
    const mode = await readAutoBuildMode(ctx);
    const { tickets, waiting, capacity } = await readNextTickets(ctx, mode, input);
    return { enabled: mode.enabled, revision: mode.revision, tickets, waiting, capacity };
  },
});
