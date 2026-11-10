import type { ExperimentalUsageLimitsOutput } from "@opencode/client";
import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { resolveOpencodeCommand } from "./cli";

export const normalizeOpencodeQuotas = (native: { data: unknown }) => {
  const data = native.data as ExperimentalUsageLimitsOutput["data"];
  const limits: { id: string; label: string; remainingPercent: number; resetsAt?: string; windowMinutes?: number }[] =
    [];
  const add = (id: string, label: string, used: number, resetsAt: number, windowMinutes?: number) => {
    if (!Number.isFinite(used)) return;
    limits.push({
      id,
      label,
      remainingPercent: Math.max(0, Math.min(100, 100 - used)),
      ...(windowMinutes ? { windowMinutes } : {}),
      ...(Number.isFinite(resetsAt) ? { resetsAt: new Date(resetsAt).toISOString() } : {}),
    });
  };
  if (data?.go) {
    for (const [id, label] of [
      ["rolling", "Go rolling window"],
      ["weekly", "Go weekly"],
      ["monthly", "Go monthly"],
    ] as const) {
      const meter = data.go[id];
      if (meter) add(id, label, meter.percent, meter.resetsAt, id === "weekly" ? 10080 : undefined);
    }
  }
  for (const budget of data?.budgets ?? []) {
    if (!Number.isFinite(budget.limit) || budget.limit < 0 || !Number.isFinite(budget.spent)) continue;
    add(
      `budget.${budget.id}`,
      "Account budget",
      budget.limit === 0 ? 100 : (budget.spent / budget.limit) * 100,
      budget.resetsAt,
    );
  }
  return {
    status: limits.length ? ("available" as const) : ("unavailable" as const),
    checkedAt: new Date().toISOString(),
    limits,
    ...(!limits.length ? { message: "No account quota is available from OpenCode for the connected providers." } : {}),
  };
};

export const readOpencodeQuotas = async (ctx: Pick<CommandContext, "process" | "signal">) => {
  try {
    ctx.signal?.throwIfAborted();
    const result = await ctx.process.run({
      command: [resolveOpencodeCommand(), "api", "GET", "/api/experimental/usage/limits", "--standalone"],
      timeoutMs: 5_000,
    });
    if (result.exitCode !== 0) throw new Error("OpenCode quota request failed.");
    return normalizeOpencodeQuotas(JSON.parse(result.stdout));
  } catch {
    ctx.signal?.throwIfAborted();
    return {
      status: "unavailable" as const,
      checkedAt: new Date().toISOString(),
      limits: [],
      message: "Could not read OpenCode quotas. Check the installation and sign-in.",
    };
  }
};

export const quotasCommand = defineCommand({
  id: "quotas",
  title: l10n("quotas.title", "Inspect account quotas"),
  description: l10n("quotas.description", "Read OpenCode Go quota windows and account budgets through the native API."),
  cli: true,
  run: readOpencodeQuotas,
});
