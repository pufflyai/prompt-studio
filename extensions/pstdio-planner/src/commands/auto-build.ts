import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { listAttempts } from "../data/attempt-storage";
import {
  type AutoBuildMode,
  matchingAutoBuildIds,
  pauseAutoBuildMode,
  readAutoBuildMode,
} from "../data/auto-build-mode";
import { resolveImplementationBase } from "../data/implementation-targets";
import { withWriteGuard } from "../data/write-guard";
import { readPlanCommand } from "../timeline/commands/read-plan";
import type { PlanRow } from "../timeline/contracts";
import { workflowName } from "../timeline/model/workflow";
import { loadAttemptReadiness } from "./attempt-readiness";
import { startAttempt } from "./run-attempt";

class AutoBuildSelectionChanged extends Error {}

const isReady = (row: PlanRow) =>
  workflowName(row.status?.name) === "todo" && !row.gate && !row.blockedReason && !row.flags.includes("human-needed");

async function selectedTicket(ctx: CommandContext, mode: AutoBuildMode, id: string) {
  const currentMode = await readAutoBuildMode(ctx);
  if (!currentMode.enabled || currentMode.revision !== mode.revision) return undefined;
  const plan = await readPlanCommand.run(ctx, {});
  const row = plan.sections.flatMap(({ rows }) => rows).find((row) => row.id === id);
  if (!row || !isReady(row) || !matchingAutoBuildIds(currentMode, plan).has(id)) return undefined;
  return row;
}

async function runAutoBuild(ctx: CommandContext) {
  const mode = await readAutoBuildMode(ctx);
  try {
    const result = await autoBuild(ctx, mode);
    // Leave failed work for inspection instead of retrying it on the next check.
    if (result.errors.length) await pauseAutoBuildMode(ctx, mode);
    return result;
  } catch (error) {
    await pauseAutoBuildMode(ctx, mode);
    throw error;
  }
}

export const autoBuildCommand = defineCommand({
  id: "auto-build",
  title: l10n("commands.autoBuild.title", "Auto build"),
  automation: true,
  mutating: true,
  async run(ctx) {
    return withWriteGuard(
      ctx,
      "attempt-launch",
      () => runAutoBuild(ctx),
      () => ({ started: [], skipped: [], errors: [] }),
    );
  },
});

async function autoBuild(ctx: CommandContext, mode: AutoBuildMode) {
  const started: { ticket: string; workspaceId: string; sessionId: string }[] = [];
  const skipped: { ticket: string; reason: string }[] = [];
  const errors: { ticket: string; message: string }[] = [];
  if (!mode.enabled) return { started, skipped, errors };
  const [plan, attempts, settings] = await Promise.all([
    readPlanCommand.run(ctx, {}),
    listAttempts(ctx.storage),
    ctx.settings.all(),
  ]);
  const attempted = new Set(
    attempts.filter((attempt) => attempt.state !== "abandoned").map((attempt) => attempt.ticketId),
  );
  const matching = matchingAutoBuildIds(mode, plan);
  const candidates = plan.sections
    .flatMap(({ rows }) => rows)
    .filter((row) => matching.has(row.id) && isReady(row) && !attempted.has(row.id));
  if (!candidates.length) return { started, skipped, errors };
  const base = await resolveImplementationBase(ctx, settings);
  for (const row of candidates) {
    try {
      if (!(await selectedTicket(ctx, mode, row.id))) {
        skipped.push({ ticket: row.shorthand, reason: "ticket-not-ready" });
        continue;
      }
      const { readiness } = await loadAttemptReadiness(ctx, row.id, { base });
      if (readiness.decision === "wait") {
        skipped.push({ ticket: row.shorthand, reason: readiness.reason });
        if (readiness.reason === "capacity-full") break;
        continue;
      }
      const result = await startAttempt(
        ctx,
        {
          ticket: row.id,
          ...(base ? { workspace: { providerId: "pstdio.worktree", params: { base } } } : {}),
        },
        async () => {
          if (!(await selectedTicket(ctx, mode, row.id))) throw new AutoBuildSelectionChanged();
          const latest = await readAutoBuildMode(ctx);
          if (!latest.enabled || latest.revision !== mode.revision) throw new AutoBuildSelectionChanged();
        },
      );
      started.push({ ticket: row.shorthand, workspaceId: result.workspace.id, sessionId: result.session.id });
    } catch (error) {
      if (error instanceof AutoBuildSelectionChanged) continue;
      errors.push({ ticket: row.shorthand, message: error instanceof Error ? error.message : String(error) });
      break;
    }
  }
  return { started, skipped, errors };
}
