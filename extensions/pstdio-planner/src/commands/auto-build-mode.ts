import { defineCommand, l10n, params, type ViewFilterGroup } from "@pstdio/sdk/extensions";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { withWriteGuard } from "../data/write-guard";
import { enqueueAutoBuild } from "../hooks/auto-build";
import { automationPolicyCommand } from "./automation-policy";

export const readAutoBuildCommand = defineCommand({
  id: "auto-build.read",
  title: "Read Auto build mode",
  cli: true,
  async run(ctx) {
    const mode = await readAutoBuildMode(ctx);
    const runs = await ctx.automation.list();
    const latest = runs
      .filter(({ commandId }) => commandId === `${ctx.extensionId}.command.auto-build`)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const result = latest?.result as { errors?: { ticket: string; message: string }[] } | undefined;
    const error =
      latest?.error?.message ?? result?.errors?.map(({ ticket, message }) => `${ticket}: ${message}`).join("\n");
    const policy = await automationPolicyCommand.run(ctx, {});
    return {
      ...mode,
      ...policy,
      running: latest?.status === "queued" || latest?.status === "running",
      error: error || undefined,
    };
  },
});

export const configureAutoBuildCommand = defineCommand({
  id: "auto-build.configure",
  title: l10n("commands.autoBuild.configure", "Configure Auto build"),
  cli: { description: "Start or stop Auto Build using the current timeline filters." },
  mutating: true,
  params: {
    enabled: params.boolean({ required: true }),
    filter: params.json<ViewFilterGroup>(),
    maxInProgress: params.number({ label: "Maximum parallel tasks" }),
  },
  async run(ctx, { enabled, filter, maxInProgress }) {
    if (maxInProgress !== undefined) {
      if (!Number.isInteger(maxInProgress) || maxInProgress < 0) {
        throw new Error("Maximum parallel tasks must be a non-negative integer.");
      }
      await ctx.settings.set("automation.maxInProgress", maxInProgress);
    }
    const mode = await withWriteGuard(ctx, "auto-build-mode", async () => {
      const current = await readAutoBuildMode(ctx);
      return saveAutoBuildMode(ctx, {
        revision: crypto.randomUUID(),
        enabled,
        filter: filter ?? current.filter,
      });
    });
    if (mode.enabled) await enqueueAutoBuild(ctx);
    return mode;
  },
});
