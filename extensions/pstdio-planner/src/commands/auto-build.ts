import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { pauseAutoBuildMode, readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
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
    if (isLiveSession(session)) return { prompted: false, sessionId: session!.id };
    const { tickets: candidates, capacity, snapshot, progressAt, active } = await readNextTickets(ctx, mode);
    const history = session ? (await ctx.sessions.list()).find(({ id }) => id === session.id) : undefined;
    const lastPromptAt = Date.parse(history?.last_request_started ?? "1970-01-01T00:00:00Z");
    const stalled = Boolean(session && Date.now() - Math.max(progressAt, lastPromptAt) >= 60 * 60 * 1000);
    if (
      (!candidates.length && !(stalled && active > 0)) ||
      (capacity.running >= capacity.limit && !stalled) ||
      (snapshot === supervisor.lastWake && active > 0 && !stalled)
    )
      return { prompted: false };
    const prompt = [
      mode.prompt,
      "## Auto Build supervisor instructions",
      "You coordinate ticket attempts. Do not implement tickets yourself or change the board to bypass its rules.",
      'First read the current mode revision with pst pstdio-planner auto-build read. Translate the user\'s work scope into one or more track, status, tags, or parent queries. Save them before choosing work with pst pstdio-planner auto-build scope --revision <revision> --queries \'<JSON array>\'; for example: [{"track":"Workbench"},{"track":"Planner"}]. Use [{}] for the whole project. Scope queries are alternatives; fields within each query must all match. Choose scope filters for eligibility, not just temporary priority. Wake checks, queries, and dispatch all use this saved scope. Update it if the user\'s request changes. Do not widen it to find extra work.',
      "Query fresh work with pst tickets next. Its default query uses the saved scope; --track, --status, --tags, or --parent can narrow it further. Queries return launchable tickets, waiting reasons, available capacity, and the current mode revision. Read a ticket's full instructions with pst tickets panel --id <ticket> before choosing it.",
      "For each relevant returned ticket, launch or resume its managed attempt with:\npst pstdio-planner auto-build dispatch --ticket <ticket> --revision <revision-from-query>",
      "An update-stack action means the existing owner's workspace has newer unsubmitted work or outdated dependency ancestry. Dispatch it to that same owner; it integrates the required base, validates the result, and records a new revision. Never fabricate a review rejection or create an alternative workspace just to repair a stack.",
      "Re-run tickets next after dispatching. Respect the user's prompt and the returned capacity. Waiting tickets are context, not permission to bypass blockers. The dispatch command enforces current ignore filters, assignments, dependencies, and capacity.",
      "Do not call run-attempt directly, create implementation sessions yourself, or change Auto Build settings.",
      mode.blockOnReview
        ? "Children wait for dependency review approval."
        : "Children may start while dependency revisions are in review. Dispatch creates their workspaces on the submitted dependency commit so their work stacks on top.",
      "When there is no more relevant work you can dispatch now, end your turn. Do not poll or run a sleep process. Auto Build wakes this session for changed work, actionable work with no active implementations, or an hour without progress. A stalled-progress reminder does not allow you to exceed capacity or bypass blockers. If Auto Build is stopped, finish your turn without dispatching more work.",
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
    await saveAutoBuildSupervisor(ctx, { ...supervisor, sessionId: supervisorId, lastWake: snapshot });
    return { prompted: true, sessionId: supervisorId };
  } catch (error) {
    await pauseAutoBuildMode(ctx, mode);
    throw error;
  }
}
