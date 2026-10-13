import { type CommandContext, defineCommand, l10n, params, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { readAutoBuildFilter } from "../data/auto-build-filter";
import { type AutoBuildMode, readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { ticketsCollection } from "../data/collections";
import { withWriteGuard } from "../data/write-guard";
import { enqueueAutoBuild } from "../hooks/auto-build";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { timelineQueryData } from "../timeline/model/query-data";
import { readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildCandidates } from "./auto-build-candidates";
import { isLiveSession, readAutoBuildAssignments } from "./auto-build-sessions";

const validateEligibility = async (ctx: CommandContext, enabled: boolean, filter: ViewFilterGroup) => {
  if (!enabled) return;
  const plan = await readPlanCommand.run(ctx, {});
  const query = timelineQueryData(plan, (_key, fallback) => fallback ?? _key);
  if (!readAutoBuildFilter(filter, query.attributes).complete)
    throw new Error("Complete or remove invalid eligible ticket filters before starting Auto Build.");
};

const scopeDefinition = (mode: Pick<AutoBuildMode, "prompt" | "eligible" | "ignore">) =>
  JSON.stringify([mode.prompt, mode.eligible, mode.ignore]);

export const readAutoBuildCommand = defineCommand({
  id: "auto-build.read",
  title: "Read Auto Build mode",
  cli: true,
  async run(ctx) {
    const mode = await readAutoBuildMode(ctx);
    const state = await readAutoBuildSupervisor(ctx);
    const [supervisor, { sessions }, capacity, runs] = await Promise.all([
      state.sessionId ? ctx.sessions.get(state.sessionId) : null,
      readAutoBuildAssignments(ctx),
      readImplementationCapacity(ctx),
      ctx.automation.list(),
    ]);
    const latest = runs
      .filter(({ commandId }) => commandId === `${ctx.extensionId}.command.auto-build`)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const ticketSessions = sessions.filter(({ id }) => id !== state.sessionId);
    let stuck =
      mode.enabled && ticketSessions.length > 0 && ticketSessions.every(({ status }) => status === "awaiting_input");
    if (mode.enabled && capacity.running === 0 && !isLiveSession(supervisor)) {
      const { candidates, blockedTickets } = await readAutoBuildCandidates(ctx, mode);
      stuck ||= candidates.length === 0 && blockedTickets.length > 0;
    }
    const work = await readAutoBuildCandidates(ctx, mode);
    return {
      ...mode,
      observations: work.observations,
      configurationError: work.configurationError,
      supervisor,
      sessions: ticketSessions,
      capacity,
      stuck,
      running: latest?.status === "queued" || latest?.status === "running",
      error: latest?.error?.message,
    };
  },
});

export const configureAutoBuildCommand = defineCommand({
  id: "auto-build.configure",
  title: l10n("commands.autoBuild.configure", "Configure Auto Build"),
  cli: { description: "Start or stop the Auto Build supervisor." },
  mutating: true,
  params: {
    enabled: params.boolean({ required: true }),
    prompt: params.longText(),
    ignore: params.json<ViewFilterGroup>(),
    eligible: params.json<ViewFilterGroup>(),
    scopeTicketIds: params.json<string[] | null>(),
    requireMergedDependencies: params.boolean({ label: "Require merged dependencies" }),
    // @deprecated Use requireMergedDependencies.
    blockOnReview: params.boolean({ label: "Block on review" }),
  },
  async run(ctx, { enabled, prompt, ignore, blockOnReview, eligible, scopeTicketIds, requireMergedDependencies }) {
    const mode = await withWriteGuard(ctx, "workflow-config", async () => {
      const current = await readAutoBuildMode(ctx);
      const nextPrompt = prompt?.trim() ?? current.prompt;
      if (enabled && !nextPrompt) throw new Error("Enter a prompt for the Auto Build supervisor.");
      const nextEligible = eligible ?? current.eligible;
      await validateEligibility(ctx, enabled, nextEligible);
      const selection = { prompt: nextPrompt, eligible: nextEligible, ignore: ignore ?? current.ignore };
      let scope = scopeTicketIds;
      if (scope === undefined)
        scope = scopeDefinition(selection) === scopeDefinition(current) ? current.scopeTicketIds : null;
      const tickets = await ticketsCollection(ctx.storage).list();
      if (scope !== null && (!Array.isArray(scope) || scope.some((id) => !tickets.some((ticket) => ticket.id === id))))
        throw new Error("Choose current tickets for Auto Build scope.");
      return saveAutoBuildMode(ctx, {
        ...current,
        ...selection,
        revision: crypto.randomUUID(),
        enabled,
        blockOnReview: blockOnReview ?? current.blockOnReview,
        scopeTicketIds: scope,
        requireMergedDependencies: requireMergedDependencies ?? current.requireMergedDependencies,
      });
    });
    if (mode.enabled) await enqueueAutoBuild(ctx);
    return mode;
  },
});
