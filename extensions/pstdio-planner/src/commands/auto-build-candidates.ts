import { type CommandContext, defineCommand } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import { listAttempts } from "../data/attempt-storage";
import { usableAutoBuildIgnore } from "../data/auto-build-ignore";
import { type AutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { ticketsCollection } from "../data/collections";
import { resolveImplementationBase } from "../data/implementation-targets";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { loadAttemptReadiness, readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildResumptions } from "./auto-build-resume";
import { readAutoBuildAssignments } from "./auto-build-sessions";

export async function readAutoBuildCandidates(ctx: CommandContext, mode: AutoBuildMode) {
  const [plan, attempts, tickets, resumptions, capacity, assignments] = await Promise.all([
    readPlanCommand.run(ctx, {}),
    listAttempts(ctx.storage),
    ticketsCollection(ctx.storage).list(),
    readAutoBuildResumptions(ctx),
    readImplementationCapacity(ctx),
    readAutoBuildAssignments(ctx),
  ]);
  const query = timelineQueryData(plan, (_key, fallback) => fallback ?? _key);
  const ignore = usableAutoBuildIgnore(mode.ignore, query.attributes);
  const ignored = new Set(ignore ? filterRowsByView(query.rows, ignore, query.attributes).map(({ id }) => id) : []);
  const attempted = new Set(attempts.filter(({ state }) => state !== "abandoned").map(({ ticketId }) => ticketId));
  const candidates: { id: string; ticket: string; title: string; action: "start" | "resume" }[] = [];
  const settings = await ctx.settings.all();
  const rows = plan.sections
    .flatMap(({ rows }) => rows)
    .filter(
      (row) =>
        !ignored.has(row.id) &&
        !row.gate &&
        !row.blockedReason &&
        !row.flags.includes("human-needed") &&
        !tickets.find(({ id }) => id === row.id)?.draft &&
        !assignments.assigned.has(row.id) &&
        (!attempted.has(row.id) || resumptions.has(row.id)),
    );
  if (capacity.running < capacity.limit && rows.length) {
    const base = await resolveImplementationBase(ctx, settings);
    for (const row of rows) {
      if (resumptions.has(row.id)) {
        candidates.push({ id: row.id, ticket: row.shorthand, title: row.title, action: "resume" });
      } else {
        const { readiness } = await loadAttemptReadiness(ctx, row.id, { base });
        if (readiness.decision === "ready")
          candidates.push({ id: row.id, ticket: row.shorthand, title: row.title, action: "start" });
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
  return { candidates, capacity, snapshot };
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
