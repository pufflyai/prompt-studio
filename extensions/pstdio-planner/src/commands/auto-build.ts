import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { listAttempts } from "../data/attempt-storage";
import { resolveImplementationBase } from "../data/implementation-targets";
import { withWriteGuard } from "../data/write-guard";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { workflowName } from "../timeline/model/workflow";
import { loadAttemptReadiness } from "./attempt-readiness";
import { startAttempt } from "./run-attempt";

export const autoBuildCommand = defineCommand({
  id: "auto-build",
  title: l10n("commands.autoBuild.title", "Auto build"),
  cli: { description: "Start ready tickets in timeline order up to Maximum in-progress tickets." },
  mutating: true,
  async run(ctx) {
    return withWriteGuard(ctx, "attempt-launch", () => autoBuild(ctx));
  },
});

async function autoBuild(ctx: CommandContext) {
  const [plan, attempts, settings] = await Promise.all([
    readPlanCommand.run(ctx, {}),
    listAttempts(ctx.storage),
    ctx.settings.all(),
  ]);
  const attempted = new Set(
    attempts.filter((attempt) => attempt.state !== "abandoned").map((attempt) => attempt.ticketId),
  );
  const candidates = plan.sections
    .flatMap(({ rows }) => rows)
    .filter(
      (row) =>
        workflowName(row.status?.name) === "todo" &&
        !row.gate &&
        !row.blockedReason &&
        !row.flags.includes("human-needed") &&
        !attempted.has(row.id),
    );
  const started: { ticket: string; workspaceId: string; sessionId: string }[] = [];
  const skipped: { ticket: string; reason: string }[] = [];
  const errors: { ticket: string; message: string }[] = [];
  if (!candidates.length) return { started, skipped, errors };
  const base = await resolveImplementationBase(ctx, settings);
  for (const row of candidates) {
    try {
      // Ticket edits and human requests can arrive while an earlier launch is running.
      const current = (await readPlanCommand.run(ctx, {})).sections
        .flatMap(({ rows }) => rows)
        .find(({ id }) => id === row.id);
      if (
        !current ||
        workflowName(current.status?.name) !== "todo" ||
        current.gate ||
        current.blockedReason ||
        current.flags.includes("human-needed")
      ) {
        skipped.push({ ticket: row.shorthand, reason: "ticket-not-ready" });
        continue;
      }
      const { readiness } = await loadAttemptReadiness(ctx, row.id, { base });
      if (readiness.decision === "wait") {
        skipped.push({ ticket: row.shorthand, reason: readiness.reason });
        if (readiness.reason === "capacity-full") break;
        continue;
      }
      const result = await startAttempt(ctx, {
        ticket: row.id,
        ...(base ? { workspace: { providerId: "pstdio.worktree", params: { base } } } : {}),
      });
      started.push({
        ticket: row.shorthand,
        workspaceId: result.workspace.id,
        sessionId: result.session.id,
      });
    } catch (error) {
      errors.push({ ticket: row.shorthand, message: error instanceof Error ? error.message : String(error) });
      // A launch failure may have created a workspace. Leave it for inspection.
      break;
    }
  }
  return { started, skipped, errors };
}
