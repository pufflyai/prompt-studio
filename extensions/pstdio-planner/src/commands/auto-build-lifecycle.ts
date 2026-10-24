import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withQueuedWriteGuard, withWriteGuard } from "../data/write-guard";
import { enqueueAutoBuild } from "../hooks/auto-build";

export const pauseAutoBuildCommand = defineCommand({
  id: "auto-build.pause",
  title: l10n("commands.autoBuild.pause", "Pause Auto Build"),
  cli: true,
  mutating: true,
  async run(ctx) {
    return withWriteGuard(ctx, "auto-build-mode", async () => {
      const mode = await readAutoBuildMode(ctx);
      if (mode.state !== "running") return mode;
      return saveAutoBuildMode(ctx, { ...mode, state: "paused", enabled: false });
    });
  },
});

export const resumeAutoBuildCommand = defineCommand({
  id: "auto-build.resume",
  title: l10n("commands.autoBuild.resume", "Resume Auto Build"),
  cli: true,
  mutating: true,
  async run(ctx) {
    const mode = await withWriteGuard(ctx, "auto-build-mode", async () => {
      const current = await readAutoBuildMode(ctx);
      if (current.state !== "paused") throw new Error("Pause Auto Build before resuming it.");
      return withQueuedWriteGuard(ctx, "attempt-launch", () =>
        withQueuedWriteGuard(ctx, "auto-build-supervisor", async () => {
          const owner = await readAutoBuildSupervisor(ctx);
          const revision = crypto.randomUUID();
          return saveAutoBuildMode(ctx, { ...current, state: "running", enabled: true, revision }, [
            {
              recordId: ctx.storage.records.id("auto-build-supervisor"),
              replace: JSON.parse(
                JSON.stringify({
                  ...owner,
                  pendingWakeRevision: revision,
                  ...(owner.scope ? { scope: { ...owner.scope, revision } } : {}),
                }),
              ),
            },
          ]);
        }),
      );
    });
    await enqueueAutoBuild(ctx);
    return mode;
  },
});
