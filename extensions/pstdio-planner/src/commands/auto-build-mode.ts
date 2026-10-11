import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
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
  cli: { description: "Start or stop Auto Build for all eligible tickets in the project." },
  mutating: true,
  params: {
    enabled: params.boolean({ required: true }),
    maxInProgress: params.number({ label: "Maximum parallel tasks" }),
  },
  async run(ctx, { enabled, maxInProgress }) {
    if (maxInProgress !== undefined) {
      if (!Number.isInteger(maxInProgress) || maxInProgress < 0) {
        throw new Error("Maximum parallel tasks must be a non-negative integer.");
      }
      await ctx.settings.set("automation.maxInProgress", maxInProgress);
    }
    const mode = await withWriteGuard(ctx, "auto-build-mode", async () => {
      return saveAutoBuildMode(ctx, {
        revision: crypto.randomUUID(),
        enabled,
      });
    });
    if (mode.enabled) await enqueueAutoBuild(ctx);
    return mode;
  },
});
