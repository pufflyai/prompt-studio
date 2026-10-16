import { defineCommand, l10n, params, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { readAutoBuildMode, readAutoBuildModeSnapshot, saveAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
import { enqueueAutoBuild } from "../hooks/auto-build";
import { readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildCandidates } from "./auto-build-candidates";
import { isLiveSession, readAutoBuildAssignments } from "./auto-build-sessions";

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
    return {
      ...mode,
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
    blockOnReview: params.boolean({ label: "Block on review" }),
  },
  async run(ctx, { enabled, prompt, ignore, blockOnReview }) {
    const configure = async () => {
      const { mode: current, record } = await readAutoBuildModeSnapshot(ctx);
      const nextPrompt = prompt?.trim() ?? current.prompt;
      if (enabled && !nextPrompt) throw new Error("Enter a prompt for the Auto Build supervisor.");
      const supervisor =
        enabled && !current.enabled
          ? await ctx.storage.records.read(ctx.storage.records.id("auto-build-supervisor"))
          : undefined;
      return saveAutoBuildMode(
        ctx,
        {
          ...current,
          revision: crypto.randomUUID(),
          enabled,
          prompt: nextPrompt,
          ignore: ignore ?? current.ignore,
          blockOnReview: blockOnReview ?? current.blockOnReview,
        },
        record,
        supervisor ? [{ recordId: supervisor.recordId, expectedRevision: supervisor.revision, replace: {} }] : [],
      );
    };
    // A previous wake must finish saving its session before a new run clears ownership.
    // Stop stays available while a wake is starting a session.
    const mode = enabled ? await withWriteGuard(ctx, "auto-build-supervisor", configure) : await configure();
    if (mode.storageOutcome.status !== "conflict" && mode.enabled) await enqueueAutoBuild(ctx);
    return mode;
  },
});
