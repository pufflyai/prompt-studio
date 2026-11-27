import type { ProviderQuotas, QuotaLimit } from "./shared";

/** A window that applies to one model family, such as Claude's `seven_day_opus` or `model_scoped`. */
export const isModelSpecific = (limit: QuotaLimit) =>
  limit.modelFamily !== undefined || /^seven_day_|^model_scoped/.test(limit.id);

/**
 * Picks the 5-hour and the general weekly window. Model-specific weekly windows stay in the popover:
 * without a general one, the weekly value is undefined and the meter shows a dash.
 */
export const headlineLimits = (provider: ProviderQuotas) => ({
  session: provider.limits.find((limit) => limit.id === "five_hour" || limit.windowMinutes === 300),
  weekly:
    provider.limits.find((limit) => limit.id === "seven_day") ??
    provider.limits.find((limit) => limit.windowMinutes === 10080 && !isModelSpecific(limit)),
});

export const formatPercent = (limit: QuotaLimit | undefined) =>
  limit ? `${Math.round(limit.remainingPercent)}%` : "–";

/** Ignore the forecast until this share of the window has passed: one early burst would project far past 100%. */
export const FORECAST_MIN_ELAPSED = 0.1;
/** On pace to use this much of the window or more: warning (orange). */
export const FORECAST_WARNING = 100;
/** On pace for this much or more, so it runs out with a fifth of the window still to go: error (red). */
export const FORECAST_ERROR = 125;

export interface QuotaForecast {
  /** Percent of the allowance used by the reset at the current pace. Same projection as Home. */
  projectedPercent: number;
  /** When it runs out at the current pace, only when that is before the reset. */
  runsOutAt?: number;
}

/**
 * Straight-line projection from the window start to the reading, carried on to the reset.
 * The pace uses `observedAt`, the time the reading was taken: a cached reading must not project
 * lower as the clock moves on. `now` only decides whether the window has already reset.
 */
export const forecastLimit = (limit: QuotaLimit, observedAt: number, now = Date.now()): QuotaForecast | undefined => {
  const reset = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN;
  const duration = (limit.windowMinutes ?? 0) * 60_000;
  if (!Number.isFinite(reset) || !Number.isFinite(observedAt) || duration <= 0 || now >= reset) return undefined;
  const start = reset - duration;
  const elapsed = Math.min(observedAt, reset) - start;
  if (elapsed < duration * FORECAST_MIN_ELAPSED) return undefined;
  const used = 100 - limit.remainingPercent;
  const projectedPercent = (used * duration) / elapsed;
  const runsOutAt = used > 0 ? start + (elapsed * 100) / used : undefined;
  return { projectedPercent, ...(runsOutAt !== undefined && runsOutAt < reset ? { runsOutAt } : {}) };
};

export type Severity = "ok" | "warning" | "error";

/** The worse of what is left now and where the current pace leads. */
export const limitSeverity = (limit: QuotaLimit, observedAt: number, now = Date.now()): Severity => {
  if (limit.remainingPercent <= 5) return "error";
  const projected = forecastLimit(limit, observedAt, now)?.projectedPercent ?? 0;
  if (projected >= FORECAST_ERROR) return "error";
  if (limit.remainingPercent <= 20 || projected >= FORECAST_WARNING) return "warning";
  return "ok";
};

/** Chakra semantic color for a limit. */
export const remainingColor = (limit: QuotaLimit | undefined, observedAt: number, now = Date.now()) => {
  if (!limit) return "fg.subtle";
  const severity = limitSeverity(limit, observedAt, now);
  if (severity === "error") return "fg.error";
  if (severity === "warning") return "fg.warning";
  return "fg.muted";
};

/** "2h 14m", "3d 4h", "now". */
export const formatResetIn = (resetsAt: string | undefined, now = Date.now()) => {
  if (!resetsAt) return undefined;
  const minutes = Math.round((Date.parse(resetsAt) - now) / 60_000);
  if (!Number.isFinite(minutes)) return undefined;
  if (minutes <= 0) return "now";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};
