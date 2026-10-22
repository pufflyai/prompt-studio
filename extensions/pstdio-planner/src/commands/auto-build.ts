import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { pauseAutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { readSessionHistory } from "../data/session-history";
import { withWriteGuard } from "../data/write-guard";
import { initialSupervisorPrompt, supervisorWakePrompt } from "./auto-build-prompts";
import { isLiveSession } from "./auto-build-sessions";
import { readNextTickets } from "./next-tickets";

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
    if (supervisor.sessionId && !session)
      throw new Error("The Auto Build supervisor was removed. Stop the paused run before starting again.");
    if (isLiveSession(session)) return { prompted: false, sessionId: session!.id };
    // A first wake needs one viable ticket. The supervisor queries the full scope before dispatching.
    const {
      tickets: candidates,
      capacity,
      snapshot,
      progressAt,
      active,
    } = await readNextTickets(ctx, mode, session ? {} : { limit: 1 });
    const history = session ? (await readSessionHistory(ctx.sessions)).find(({ id }) => id === session.id) : undefined;
    const lastPromptAt = Date.parse(history?.last_request_started ?? "1970-01-01T00:00:00Z");
    const stalled = Boolean(session && Date.now() - Math.max(progressAt, lastPromptAt) >= 60 * 60 * 1000);
    if (
      (!candidates.length && !(stalled && active > 0)) ||
      (capacity.running >= capacity.limit && !stalled) ||
      (snapshot === supervisor.lastWake && active > 0 && !stalled)
    )
      return { prompted: false };
    const current = await readAutoBuildMode(ctx);
    if (!current.enabled || current.revision !== mode.revision) return { prompted: false };
    let supervisorId = session?.id;
    if (supervisorId) {
      await ctx.sessions.followup({
        sessionId: supervisorId,
        prompt: supervisorWakePrompt({ stalled, refreshScope: supervisor.scope?.revision !== mode.revision }),
      });
    } else {
      const home = await ctx.workspaces.getDefault();
      const created = await ctx.sessions.create({
        title: "Auto Build supervisor",
        workspaceId: home?.id,
        prompt: initialSupervisorPrompt(mode),
        harness: mode.supervisorModel,
      });
      supervisorId = created.id;
    }
    await saveAutoBuildSupervisor(ctx, { ...supervisor, sessionId: supervisorId, lastWake: snapshot });
    return { prompted: true, sessionId: supervisorId };
  } catch (error) {
    await pauseAutoBuildMode(ctx, mode);
    throw error;
  }
}
