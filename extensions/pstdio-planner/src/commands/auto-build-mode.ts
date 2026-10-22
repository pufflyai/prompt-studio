import { type CommandContext, defineCommand, l10n, params, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { readAutoBuildFilter } from "../data/auto-build-filter";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
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
    const running = latest?.status === "queued" || latest?.status === "running";
    const ticketSessions = sessions.filter(({ id }) => id !== state.sessionId);
    const inspect = mode.enabled && !running && capacity.running === 0 && !isLiveSession(supervisor);
    // Completion reads only ticket statuses. Git readiness checks wait until no startup or work is active.
    const work =
      mode.state !== "stopped" ? await readAutoBuildCandidates(ctx, mode, inspect ? {} : { limit: 0 }) : undefined;
    const completed = Boolean(work?.completed);
    let stuck =
      mode.enabled &&
      !completed &&
      ticketSessions.length > 0 &&
      ticketSessions.every(({ status }) => status === "awaiting_input");
    if (inspect && work) stuck ||= work.readyTicketCount === 0 && work.blockedTickets.length > 0;
    return {
      ...mode,
      reviewRequests: work?.reviewRequests ?? [],
      requestErrors: work?.requestErrors ?? [],
      observations: work?.observations ?? [],
      waitingTickets: work?.waitingTickets ?? [],
      configurationError: work?.configurationError ?? null,
      supervisor,
      sessions: ticketSessions,
      capacity,
      completed,
      matchingTicketCount: work?.matchingTicketCount,
      readyTicketCount: work?.readyTicketCount,
      stuck,
      running,
      error: completed ? undefined : latest?.error?.message,
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
    supervisorModel: params.harness({ label: l10n("timeline.autoBuild.supervisorModel", "Supervisor model") }),
    eligible: params.json<ViewFilterGroup>(),
    requireMergedDependencies: params.boolean({ label: "Require merged dependencies" }),
    // @deprecated Use requireMergedDependencies.
    blockOnReview: params.boolean({ label: "Block on review" }),
  },
  async run(ctx, { enabled, prompt, supervisorModel, blockOnReview, eligible, requireMergedDependencies }) {
    const configure = () =>
      withWriteGuard(ctx, "auto-build-mode", async () => {
        const current = await readAutoBuildMode(ctx);
        const nextPrompt = prompt?.trim() ?? current.prompt;
        if (enabled && !nextPrompt) throw new Error("Enter a prompt for the Auto Build supervisor.");
        const nextEligible = eligible ?? current.eligible;
        await validateEligibility(ctx, enabled, nextEligible);
        return saveAutoBuildMode(
          ctx,
          {
            ...current,
            revision: crypto.randomUUID(),
            enabled,
            state: enabled ? "running" : "stopped",
            prompt: nextPrompt,
            eligible: nextEligible,
            supervisorModel: supervisorModel ?? current.supervisorModel,
            blockOnReview: blockOnReview ?? current.blockOnReview,
            requireMergedDependencies: requireMergedDependencies ?? current.requireMergedDependencies,
          },
          enabled && current.state === "stopped"
            ? [{ recordId: ctx.storage.records.id("auto-build-supervisor"), replace: {} }]
            : [],
        );
      });
    // A previous wake must finish saving its session before a new run clears ownership.
    // Stop stays available while a wake is starting a session.
    const mode = enabled ? await withWriteGuard(ctx, "auto-build-supervisor", configure) : await configure();
    if (mode.enabled) await enqueueAutoBuild(ctx);
    return mode;
  },
});
