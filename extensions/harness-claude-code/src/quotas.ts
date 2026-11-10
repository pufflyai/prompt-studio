import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { readClaudeUsage } from "./quota-probe";

const labels: Record<string, string> = {
  five_hour: "5-hour window",
  seven_day: "Weekly",
  seven_day_sonnet: "Sonnet weekly",
  seven_day_opus: "Opus weekly",
};

export const normalizeClaudeQuotas = (native: Record<string, unknown>) => {
  const windows = native.rate_limits;
  const limits = Object.entries(windows && typeof windows === "object" ? windows : {}).flatMap(([id, value]) =>
    (Array.isArray(value) ? value : [value]).flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const window = entry as { utilization?: number; resets_at?: string; display_name?: string };
      if (typeof window.utilization !== "number" || !Number.isFinite(window.utilization)) return [];
      const date = typeof window.resets_at === "string" ? Date.parse(window.resets_at) : NaN;
      let key = id;
      let label = labels[id] ?? id.replaceAll("_", " ");
      if (window.display_name) {
        key = `${id}.${window.display_name}`;
        label = `${window.display_name} weekly`;
      }
      return [
        {
          id: key,
          label,
          remainingPercent: Math.max(0, Math.min(100, 100 - window.utilization)),
          ...(Number.isFinite(date) ? { resetsAt: new Date(date).toISOString() } : {}),
        },
      ];
    }),
  );
  return {
    status: limits.length ? ("available" as const) : ("unavailable" as const),
    checkedAt: new Date().toISOString(),
    limits,
    ...(!limits.length ? { message: "Claude Code has no account quota data available for this sign-in." } : {}),
  };
};

export const readClaudeQuotas = async (ctx: Pick<CommandContext, "signal">) => {
  try {
    return normalizeClaudeQuotas(await readClaudeUsage(ctx.signal));
  } catch {
    ctx.signal?.throwIfAborted();
    return {
      status: "unavailable" as const,
      checkedAt: new Date().toISOString(),
      limits: [],
      message: "Could not read Claude Code quotas. Check the installation and sign-in.",
    };
  }
};

export const quotasCommand = defineCommand({
  id: "quotas",
  title: l10n("quotas.title", "Inspect account quotas"),
  description: l10n("quotas.description", "Read Claude Code's native account quota snapshot without starting a turn."),
  cli: true,
  run: readClaudeQuotas,
});
