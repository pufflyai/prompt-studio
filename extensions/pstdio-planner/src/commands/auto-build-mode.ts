import { defineCommand, l10n, params, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
import { enqueueAutoBuild } from "../hooks/auto-build";
import { readImplementationCapacity } from "./attempt-readiness";
import { readAutoBuildAssignments } from "./auto-build-sessions";

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
    return {
      ...mode,
      supervisor,
      sessions: sessions.filter(({ id }) => id !== state.sessionId),
      capacity,
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
  },
  async run(ctx, { enabled, prompt, ignore }) {
    const mode = await withWriteGuard(ctx, "auto-build-mode", async () => {
      const current = await readAutoBuildMode(ctx);
      const nextPrompt = prompt?.trim() ?? current.prompt;
      if (enabled && !nextPrompt) throw new Error("Enter a prompt for the Auto Build supervisor.");
      return saveAutoBuildMode(ctx, {
        ...current,
        revision: crypto.randomUUID(),
        enabled,
        prompt: nextPrompt,
        ignore: ignore ?? current.ignore,
      });
    });
    if (mode.enabled) await enqueueAutoBuild(ctx);
    return mode;
  },
});
