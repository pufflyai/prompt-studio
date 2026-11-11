import { type CommandContext, defineCommand, l10n } from "@pstdio/sdk/extensions";
import { readCodexAccountRequest } from "./account-status";

interface NativeWindow {
  usedPercent?: number | null;
  windowDurationMins?: number;
  resetsAt?: number;
}
interface NativeLimits {
  limitName?: string | null;
  primary?: NativeWindow | null;
  secondary?: NativeWindow | null;
}
interface NativeQuotas {
  rateLimits?: NativeLimits;
  rateLimitsByLimitId?: Record<string, NativeLimits>;
}

const windowLabel = (window: NativeWindow, fallback: string) => {
  const minutes = window.windowDurationMins;
  if (!minutes) return fallback;
  if (minutes === 10080) return "Weekly";
  if (minutes % 1440 === 0) return `${minutes / 1440}-day window`;
  if (minutes % 60 === 0) return `${minutes / 60}-hour window`;
  return `${minutes}-minute window`;
};

export const normalizeCodexQuotas = (native: NativeQuotas) => {
  const buckets = Object.entries(native.rateLimitsByLimitId ?? {});
  if (!buckets.length && native.rateLimits) buckets.push(["codex", native.rateLimits]);
  const limits = buckets.flatMap(([bucketId, bucket]) =>
    (["primary", "secondary"] as const).flatMap((id) => {
      const window = bucket[id];
      if (typeof window?.usedPercent !== "number" || !Number.isFinite(window.usedPercent)) return [];
      const resetsAt =
        typeof window.resetsAt === "number" && Number.isFinite(window.resetsAt)
          ? new Date(window.resetsAt * 1000).toISOString()
          : undefined;
      return [
        {
          id: `${bucketId}.${id}`,
          label: `${bucket.limitName ?? bucketId} · ${windowLabel(window, id === "primary" ? "Current window" : "Longer window")}`,
          remainingPercent: Math.max(0, Math.min(100, 100 - window.usedPercent)),
          ...(window.windowDurationMins && window.windowDurationMins > 0
            ? { windowMinutes: window.windowDurationMins }
            : {}),
          ...(resetsAt ? { resetsAt } : {}),
        },
      ];
    }),
  );
  return {
    status: limits.length ? ("available" as const) : ("unavailable" as const),
    checkedAt: new Date().toISOString(),
    limits,
    ...(!limits.length ? { message: "No account quota is available for this Codex sign-in." } : {}),
  };
};

export const readCodexQuotas = async (ctx: Pick<CommandContext, "signal">) => {
  try {
    return normalizeCodexQuotas(
      await readCodexAccountRequest<NativeQuotas>("account/rateLimits/read", {}, undefined, ctx.signal),
    );
  } catch {
    ctx.signal?.throwIfAborted();
    return {
      status: "unavailable" as const,
      checkedAt: new Date().toISOString(),
      limits: [],
      message: "Could not read Codex quotas. Check the installation and sign-in.",
    };
  }
};

export const quotasCommand = defineCommand({
  id: "quotas",
  title: l10n("quotas.title", "Inspect account quotas"),
  description: l10n(
    "quotas.description",
    "Read remaining Codex account allowance and reset times without starting a turn.",
  ),
  cli: true,
  run: readCodexQuotas,
});
