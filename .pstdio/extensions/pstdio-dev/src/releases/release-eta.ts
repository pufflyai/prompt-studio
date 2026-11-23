import { TEST_CATEGORIES, type TestCategory } from "./test-counts";
import type { ReleaseHealth } from "./types";

/**
 * Estimated agentic hours to fix one failing test, by test category. An agent reproduces,
 * diagnoses, fixes and verifies in parallel with CI, so these are far below human estimates.
 * Quarantine and performance failures do not block a release, so they cost nothing here.
 */
export const AGENTIC_HOURS_PER_FAILURE: Record<TestCategory, number> = {
  "end-to-end": 0.75,
  components: 0.5,
  backend: 0.5,
  packages: 0.25,
  harness: 0.5,
  performance: 0,
  quarantine: 0,
};
/** Used when a run was cached before failures were recorded by category. */
export const FALLBACK_HOURS_PER_FAILURE = 0.6;

export type EtaGrouping = "run" | "hour" | "day" | "week" | "month";

export interface EtaBreakdown {
  category: TestCategory;
  failed: number;
  hours: number;
}

export interface ReleaseEta {
  run: ReleaseHealth;
  /** Failing tests that block a release. */
  blocking: number;
  hours: number;
  breakdown: EtaBreakdown[];
  /** True when the run predates per-category failures and used the fallback rate. */
  estimated: boolean;
}

export const releaseEta = (run: ReleaseHealth) => {
  if (!run.failedCategories) {
    // Older runs only recorded a total, which can include quarantined and performance failures.
    const blocking = run.counts.failed;
    return { run, blocking, hours: blocking * FALLBACK_HOURS_PER_FAILURE, breakdown: [], estimated: true };
  }
  const breakdown = TEST_CATEGORIES.flatMap(({ id }) => {
    const failed = run.failedCategories?.[id] ?? 0;
    return failed ? [{ category: id, failed, hours: failed * AGENTIC_HOURS_PER_FAILURE[id] }] : [];
  });
  return {
    run,
    blocking: breakdown.filter(({ hours }) => hours > 0).reduce((sum, { failed }) => sum + failed, 0),
    hours: breakdown.reduce((sum, { hours }) => sum + hours, 0),
    breakdown,
    estimated: false,
  };
};

const pad = (value: number) => String(value).padStart(2, "0");
const DAY_MS = 86_400_000;

/** Bucket key in UTC for a run's creation time. */
export const etaBucket = (createdAt: string, grouping: EtaGrouping, id: number) => {
  const time = new Date(createdAt);
  const day = createdAt.slice(0, 10);
  if (grouping === "run") return `${createdAt}#${id}`;
  if (grouping === "hour") return `${day}T${pad(time.getUTCHours())}:00Z`;
  if (grouping === "day") return day;
  if (grouping === "month") return `${day.slice(0, 7)}-01`;
  const monday = new Date(Date.parse(day) - ((time.getUTCDay() + 6) % 7) * DAY_MS);
  return monday.toISOString().slice(0, 10);
};

export interface EtaPoint {
  key: string;
  /** The latest finished run in the bucket: the ETA describes the state of the branch, not a sum. */
  latest: ReleaseEta;
  runs: number;
}

/**
 * An ETA is known only when every test log was read and a failed run recorded the failures behind it.
 * Otherwise a missing report would show as a confident 0h.
 */
const hasCompleteEvidence = (run: ReleaseHealth) =>
  run.counts.reports > 0 && !run.errors.length && !(run.failedJobs.length && !run.counts.failed);

/** Group finished runs with complete evidence and keep the latest one of each bucket, oldest bucket first. */
export const etaSeries = (runs: ReleaseHealth[], grouping: EtaGrouping) => {
  const finished = runs.filter((run) => run.status === "completed" && hasCompleteEvidence(run));
  const buckets = new Map<string, EtaPoint>();
  for (const run of [...finished].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = etaBucket(run.createdAt, grouping, run.id);
    const current = buckets.get(key);
    buckets.set(key, { key, latest: releaseEta(run), runs: (current?.runs ?? 0) + 1 });
  }
  return [...buckets.values()];
};

export const formatEtaKey = (key: string, grouping: EtaGrouping) => {
  const iso = key.split("#")[0]!;
  const dateOnly = grouping === "day" || grouping === "week" || grouping === "month";
  const date = new Date(dateOnly ? `${iso}T00:00:00Z` : iso);
  let options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  if (grouping === "month") options = { month: "short", year: "numeric", timeZone: "UTC" };
  else if (!dateOnly) options = { ...options, hour: "2-digit", minute: "2-digit" };
  const label = date.toLocaleString(undefined, options);
  return grouping === "week" ? `Week of ${label}` : label;
};

export const formatHours = (hours: number) => {
  if (hours === 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Number(hours.toFixed(1)).toLocaleString()}h`;
};
