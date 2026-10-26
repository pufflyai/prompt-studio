import { contract } from "./contract";

export interface Measurement {
  durationMs: number;
  correct: boolean;
  scanned: number | null;
  materialized: number | null;
  returned: number;
  fullOwnerLoads: number | null;
  durable: boolean;
}

export const assess = (sample: Measurement) => {
  const failures: string[] = [];
  if (!Number.isFinite(sample.durationMs) || sample.durationMs >= contract.ceilingMs) failures.push("latency");
  if (!sample.correct) failures.push("incorrect-results");
  if (!sample.durable) failures.push("durability-unproved");
  if (sample.returned !== 100) failures.push("incomplete-page");
  if (sample.fullOwnerLoads !== 0) failures.push("owner-wide-hydration-or-unknown");
  if (sample.scanned === null || sample.materialized === null) failures.push("work-unmeasured");
  if (sample.materialized !== null && sample.materialized > 100) failures.push("hidden-full-load");
  if (sample.scanned !== null && sample.scanned > 100) failures.push("unbounded-scan");
  return { passed: failures.length === 0, failures };
};

export const summarize = (samples: number[]) => {
  if (!samples.length) throw new Error("No measurements");
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
  return { count: samples.length, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1)! };
};
