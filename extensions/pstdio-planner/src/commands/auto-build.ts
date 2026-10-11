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
import { readAutoBuildResumptions, resumeAutoBuildAttempt } from "./auto-build-resume";
import { startAttempt } from "./run-attempt";

class AutoBuildSelectionChanged extends Error {}

const isReady = (row: PlanRow) => {
  const status = workflowName(row.status?.name);
  return (
    (status === "todo" || status === "in-progress") &&
    !row.gate &&
    !row.blockedReason &&
    !row.flags.includes("human-needed")
  );
};

async function selectedTicket(ctx: CommandContext, mode: AutoBuildMode, candidate: PlanRow) {
  const currentMode = await readAutoBuildMode(ctx);
  if (!currentMode.enabled || currentMode.revision !== mode.revision) return undefined;
  const plan = await readPlanCommand.run(ctx, {});
  const row = plan.sections.flatMap(({ rows }) => rows).find((row) => row.id === candidate.id);
  if (!row || !isReady(row) || !matchingAutoBuildIds(currentMode, plan).has(row.id)) return undefined;
  if (workflowName(row.status?.name) !== workflowName(candidate.status?.name)) return undefined;
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
  const [plan, attempts, settings, resumptions] = await Promise.all([
    readPlanCommand.run(ctx, {}),
    listAttempts(ctx.storage),
    ctx.settings.all(),
    readAutoBuildResumptions(ctx),
  ]);
  const attempted = new Set(
    attempts.filter((attempt) => attempt.state !== "abandoned").map((attempt) => attempt.ticketId),
  );
  const matching = matchingAutoBuildIds(mode, plan);
  const candidates = plan.sections
    .flatMap(({ rows }) => rows)
    .filter(
      (row) =>
        matching.has(row.id) &&
        isReady(row) &&
        (resumptions.has(row.id) || (workflowName(row.status?.name) === "todo" && !attempted.has(row.id))),
    );
  if (!candidates.length) return { started, skipped, errors };
  for (const row of candidates) {
    try {
      const result = await dispatchTicket(ctx, mode, row, settings, resumptions.has(row.id));
      if (result.decision === "wait") {
        skipped.push({ ticket: row.shorthand, reason: result.reason });
        if (result.reason === "capacity-full") break;
      } else {
        started.push({ ticket: row.shorthand, workspaceId: result.workspaceId, sessionId: result.sessionId });
      }
    } catch (error) {
      if (error instanceof AutoBuildSelectionChanged) continue;
      errors.push({ ticket: row.shorthand, message: error instanceof Error ? error.message : String(error) });
      break;
    }
  }
  return { started, skipped, errors };
}

async function dispatchTicket(
  ctx: CommandContext,
  mode: AutoBuildMode,
  row: PlanRow,
  settings: Record<string, unknown>,
  resume: boolean,
) {
  if (!(await selectedTicket(ctx, mode, row))) return { decision: "wait" as const, reason: "ticket-not-ready" };
  const beforeDispatch = async () => {
    if (!(await selectedTicket(ctx, mode, row))) throw new AutoBuildSelectionChanged();
    const latest = await readAutoBuildMode(ctx);
    if (!latest.enabled || latest.revision !== mode.revision) throw new AutoBuildSelectionChanged();
  };
  if (resume) return resumeAutoBuildAttempt(ctx, row.id, beforeDispatch);
  const base = await resolveImplementationBase(ctx, settings);
  const { readiness } = await loadAttemptReadiness(ctx, row.id, { base });
  if (readiness.decision === "wait") return readiness;
  const result = await startAttempt(
    ctx,
    {
      ticket: row.id,
      ...(base ? { workspace: { providerId: "pstdio.worktree", params: { base } } } : {}),
    },
    beforeDispatch,
  );
  return { decision: "started" as const, workspaceId: result.workspace.id, sessionId: result.session.id };
}
