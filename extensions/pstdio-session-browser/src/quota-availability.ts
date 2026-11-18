import { type CommandRef, defineCommand, type ExtensionContextBase, l10n, params } from "@pstdio/sdk/extensions";

type QuotaSnapshot = {
  status: string;
  limits: { remainingPercent: number; resetsAt?: string; modelFamily?: string }[];
  restartAfterQuotaReset?: boolean;
};
const unknown = () => ({
  known: false,
  limited: false,
  restartAfterQuotaReset: false,
  resetsAt: undefined as string | undefined,
});

export const readQuotaAvailability = async (
  ctx: Pick<ExtensionContextBase, "commands"> & { signal?: AbortSignal },
  harnessId: string,
  modelId?: string | null,
) => {
  const extensionId = /^(.*)\.harness\.[^.]+$/.exec(harnessId)?.[1];
  if (!extensionId) return unknown();
  const command: CommandRef<Record<string, never>, QuotaSnapshot> = { kind: "command", extensionId, id: "quotas" };
  try {
    const result = await ctx.commands.execute(command, { params: {} });
    if (
      !result.ok ||
      result.value?.status !== "available" ||
      !Array.isArray(result.value.limits) ||
      !result.value.limits.length
    )
      return unknown();
    if (
      !result.value.limits.every(
        (limit) =>
          limit &&
          Number.isFinite(limit.remainingPercent) &&
          limit.remainingPercent >= 0 &&
          limit.remainingPercent <= 100,
      )
    )
      return unknown();
    const modelParts = modelId && modelId !== "default" ? modelId.toLowerCase().split(/[^a-z0-9]+/) : undefined;
    const applicableLimits = result.value.limits.filter(
      ({ modelFamily }) => !modelFamily || !modelParts || modelParts.includes(modelFamily),
    );
    if (!applicableLimits.length) return unknown();
    const exhausted = applicableLimits.filter(({ remainingPercent }) => remainingPercent === 0);
    const dates = exhausted.map((limit) => Date.parse(limit.resetsAt ?? ""));
    const knownReset = dates.length > 0 && dates.every(Number.isFinite) && Math.max(...dates) > Date.now();
    return {
      known: true,
      limited: exhausted.length > 0,
      restartAfterQuotaReset: result.value.restartAfterQuotaReset === true,
      resetsAt: knownReset ? new Date(Math.max(...dates)).toISOString() : undefined,
    };
  } catch {
    ctx.signal?.throwIfAborted();
    return unknown();
  }
};

export const quotaAvailability = defineCommand({
  id: "quota-availability",
  title: l10n("quota.availability.title", "Read harness quota availability"),
  cli: true,
  params: { harnessId: params.text({ required: true }), modelId: params.text() },
  run: (ctx, input) => readQuotaAvailability(ctx, input.harnessId, input.modelId),
});
