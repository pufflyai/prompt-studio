import { type CommandContext, defineCommand } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import { findPendingPrerequisites } from "../data/attempt-readiness";
import { listAttempts } from "../data/attempt-storage";
import { usableAutoBuildIgnore } from "../data/auto-build-ignore";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { ticketsCollection } from "../data/collections";
import { resolveImplementationBase } from "../data/implementation-targets";
import { readTicketReviewRequests } from "../data/review-request-storage";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { workflowName } from "../timeline/model/workflow";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";

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
  const ignore = usableAutoBuildIgnore(mode.ignore, query.attributes);
  const ignored = new Set(ignore ? filterRowsByView(query.rows, ignore, query.attributes).map(({ id }) => id) : []);
  const attempted = new Set(attempts.filter(({ state }) => state !== "abandoned").map(({ ticketId }) => ticketId));
  const candidates: { id: string; ticket: string; title: string; action: "start" | "resume"; baseHeadSha?: string }[] =
    [];
  const blockedTickets: string[] = [];
  const settings = await ctx.settings.all();
  const pending = plan.sections
    .flatMap(({ rows }) => rows)
    .filter(
      (row) =>
        !ignored.has(row.id) && !tickets.find(({ id }) => id === row.id)?.draft && !assignments.assigned.has(row.id),
    );
  const rows = pending.filter((row) => {
    const blocked =
      row.gate ||
      row.blockedReason ||
      workflowName(row.status?.name) === "blocked" ||
      row.flags.includes("human-needed") ||
      findPendingPrerequisites(byRef.get(row.id)!, byRef, requests).length > 0;
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
          dependencyReview: mode.blockOnReview ? "approved" : "submitted",
        });
        if (readiness.decision === "ready")
          candidates.push({
            id: row.id,
            ticket: row.shorthand,
            title: row.title,
            action: "start",
            baseHeadSha: readiness.baseHeadSha,
          });
        else blockedTickets.push(row.shorthand);
      }
    }
  }
  // Ticket bodies and review answers matter even when the set of candidates stays the same.
  const fingerprint = JSON.stringify({
    revision: mode.revision,
    tickets: tickets.sort((a, b) => a.id.localeCompare(b.id)),
    rows: plan.sections.flatMap(({ rows }) => rows),
    candidates,
    capacity,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fingerprint));
  const snapshot = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { candidates, capacity, snapshot, blockedTickets };
}

export const autoBuildCandidatesCommand = defineCommand({
  id: "auto-build.candidates",
  title: "Read Auto Build candidates",
  cli: true,
  async run(ctx) {
    const mode = await readAutoBuildMode(ctx);
    const { candidates, capacity } = await readAutoBuildCandidates(ctx, mode);
    return { enabled: mode.enabled, revision: mode.revision, candidates, capacity };
  },
});
