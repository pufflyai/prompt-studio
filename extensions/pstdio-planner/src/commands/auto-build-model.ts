import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { withWriteGuard } from "../data/write-guard";

export const selectAutoBuildModelCommand = defineCommand({
  id: "auto-build.select-model",
  title: l10n("commands.autoBuild.selectModel", "Supervisor model"),
  cli: true,
  mutating: true,
  params: {
    supervisorModel: params.harness({
      required: true,
      label: l10n("timeline.autoBuild.supervisorModel", "Supervisor model"),
    }),
  },
  async run(ctx, { supervisorModel }) {
    return withWriteGuard(ctx, "auto-build-mode", async () => {
      const current = await readAutoBuildMode(ctx);
      return saveAutoBuildMode(ctx, { ...current, supervisorModel });
    });
  },
});
