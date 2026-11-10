import { type CommandContext, commandRef } from "@pstdio/sdk/extensions";

export interface QuotaLimit {
  id: string;
  label: string;
  remainingPercent: number;
  resetsAt?: string;
  windowMinutes?: number;
  history?: { at: string; usedPercent: number }[];
}
export interface QuotaSnapshot {
  status: "available" | "unavailable" | "unsupported";
  checkedAt: string;
  message?: string;
  limits: QuotaLimit[];
}
export interface QuotaReport extends QuotaSnapshot {
  id: string;
  label: string;
  icon?: string;
}

// These four extension commands are the complete integration for Home.
const providers = [
  ["harness-codex", "Codex"],
  ["harness-claude-code", "Claude Code"],
  ["harness-open-code", "OpenCode"],
  ["harness-pi", "Pi"],
].map(([name, label]) => ({
  id: name!,
  label: label!,
  command: commandRef.forExtension({ publisher: "pstdio", name: name! })<Record<string, never>, QuotaSnapshot>(
    "quotas",
  ),
}));

const validSnapshot = (value: QuotaSnapshot) =>
  value &&
  ["available", "unavailable", "unsupported"].includes(value.status) &&
  typeof value.checkedAt === "string" &&
  Number.isFinite(Date.parse(value.checkedAt)) &&
  (value.message === undefined || typeof value.message === "string") &&
  Array.isArray(value.limits) &&
  (value.status !== "available" || value.limits.length > 0) &&
  value.limits.every(
    (limit) =>
      limit &&
      typeof limit.id === "string" &&
      typeof limit.label === "string" &&
      Number.isFinite(limit.remainingPercent) &&
      limit.remainingPercent >= 0 &&
      limit.remainingPercent <= 100 &&
      (limit.windowMinutes === undefined || (Number.isFinite(limit.windowMinutes) && limit.windowMinutes > 0)) &&
      (limit.resetsAt === undefined ||
        (typeof limit.resetsAt === "string" && Number.isFinite(Date.parse(limit.resetsAt)))),
  );

const quotaInventory = async (extensions: CommandContext["extensions"]) => {
  if (!extensions) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Optional icon metadata must not hold up native quota values.
    return await Promise.race([
      extensions.list(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), 1000);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

export const readQuotas = async (ctx: Pick<CommandContext, "commands" | "signal" | "extensions">) => {
  const inventory = quotaInventory(ctx.extensions);
  const reports = await Promise.all(
    providers.map(async (provider) => {
      try {
        const outcome = await ctx.commands.execute(provider.command, { params: {} });
        if (!outcome.ok && outcome.code === "command_not_found") return undefined;
        if (outcome.ok && validSnapshot(outcome.value))
          return { ...outcome.value, id: provider.id, label: provider.label };
      } catch {
        ctx.signal?.throwIfAborted();
      }
      return {
        id: provider.id,
        label: provider.label,
        status: "unavailable" as const,
        checkedAt: new Date().toISOString(),
        limits: [],
        message: "Could not check quotas. Refresh to try again.",
      };
    }),
  );
  const metadata = await inventory;
  ctx.signal?.throwIfAborted();
  const entries = [...(metadata?.extensions ?? []), ...(metadata?.marketplace ?? [])];
  return reports
    .filter((report) => report !== undefined)
    .map((report) => ({
      ...report,
      icon: entries.find((entry) => entry.extensionId === `pstdio.${report.id}` && entry.icon)?.icon ?? undefined,
    }));
};
