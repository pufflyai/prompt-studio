import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { PlannerStorageUpgradeBusy } from "../data/attempt-upgrade";
import { pauseAutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
import { readAutoBuildCandidates } from "./auto-build-candidates";
import { isLiveSession } from "./auto-build-sessions";

export const autoBuildCommand = defineCommand({
  id: "auto-build",
  title: l10n("commands.autoBuild.title", "Auto build"),
  automation: true,
  mutating: true,
  async run(ctx) {
    return withWriteGuard(
      ctx,
      "auto-build-supervisor",
      () => wakeSupervisor(ctx),
      () => ({ prompted: false }),
    );
  },
});

async function wakeSupervisor(ctx: CommandContext) {
  const mode = await readAutoBuildMode(ctx);
  if (!mode.enabled) return { prompted: false };
  try {
    const supervisor = await readAutoBuildSupervisor(ctx);
    const session = supervisor.sessionId ? await ctx.sessions.get(supervisor.sessionId) : null;
    if (isLiveSession(session)) return { prompted: false, sessionId: session!.id };
    const { candidates, capacity, snapshot, scopeUnresolved, scopeOptions } = await readAutoBuildCandidates(ctx, mode);
    if (
      (!candidates.length && !scopeUnresolved) ||
      capacity.running >= capacity.limit ||
      snapshot === supervisor.lastWake
    )
      return { prompted: false };
    const prompt = [
      mode.prompt,
      "## Auto Build supervisor instructions",
      "You coordinate ticket attempts. Do not implement tickets yourself or change the board to bypass its rules.",
      ...(scopeUnresolved
        ? [
            `Resolve the user prompt into explicit ticket IDs once. Scope options: ${JSON.stringify(scopeOptions)}. Use pst pstdio-planner auto-build scope --revision ${mode.revision} --ticket-ids '["<ticket-id>"]'. Select only authorized tickets; prerequisite closure is context, not permission. Then reread candidates for the new revision. Do not change other settings.`,
          ]
        : []),
      "Read current valid, unassigned tickets and available capacity with:",
      "pst pstdio-planner auto-build candidates",
      `For each relevant candidate, launch or resume its managed attempt with:\npst pstdio-planner auto-build dispatch --ticket <ticket> --revision ${mode.revision}`,
      "Re-read candidates after dispatching. Respect the user's prompt and the returned capacity. The dispatch command enforces current ignore filters, assignments, dependencies, and capacity.",
      "Do not call run-attempt directly, create implementation sessions yourself, or change Auto Build settings beyond resolving its initial scope.",
      "Dependency dispatch uses configured completion and selected or unambiguous submitted commits. A handoff does not request another reviewer. Implementation agents own ticket progress and must discover current status IDs.",
      "When there is no more relevant work you can dispatch now, end your turn. Do not poll or run a sleep process. Auto Build will re-prompt this same session when the board changes or capacity frees up. If Auto Build is stopped, finish your turn without dispatching more work.",
      `Current capacity: ${capacity.running}/${capacity.limit}. Candidates: ${JSON.stringify(candidates)}.`,
    ].join("\n\n");
    const current = await readAutoBuildMode(ctx);
    if (!current.enabled || current.revision !== mode.revision) return { prompted: false };
    let supervisorId = session?.id;
    if (supervisorId) {
      await ctx.sessions.followup({ sessionId: supervisorId, prompt });
    } else {
      const home = await ctx.workspaces.getDefault();
      const created = await ctx.sessions.create({ title: "Auto Build supervisor", workspaceId: home?.id, prompt });
      supervisorId = created.id;
    }
    await saveAutoBuildSupervisor(ctx, { sessionId: supervisorId, lastWake: snapshot });
    return { prompted: true, sessionId: supervisorId };
  } catch (error) {
    if (error instanceof PlannerStorageUpgradeBusy) return { prompted: false, reason: error.message };
    await pauseAutoBuildMode(ctx, mode);
    throw error;
  }
}
