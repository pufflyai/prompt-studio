// Benchmark samples are skewed by outliers, so the dashboard reports medians with
// percentile bootstrap intervals instead of means with normal-theory intervals.
const RESAMPLES = 2000;

export type Verdict = "improved" | "regressed" | "unchanged";

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// A fixed seed keeps the same results showing the same interval on every reload.
const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const resample = (values: number[], random: () => number) =>
  values.map(() => values[Math.floor(random() * values.length)]);

const interval = (estimates: number[]) => {
  const sorted = estimates.sort((a, b) => a - b);
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
  return { low: at(0.025), high: at(0.975) };
};

export const summarize = (values: number[]) => {
  const random = seeded(1);
  const medians = Array.from({ length: RESAMPLES }, () => median(resample(values, random)));
  return { median: median(values), ...interval(medians), samples: values.length };
};

// Every tracked metric is better when lower: time, CPU share, and memory.
export const compareSamples = (base: number[], head: number[]) => {
  const random = seeded(2);
  const changes = Array.from(
    { length: RESAMPLES },
    () => median(resample(head, random)) / median(resample(base, random)) - 1,
  );
  const { low, high } = interval(changes);
  let verdict: Verdict = "unchanged";
  if (high < 0) verdict = "improved";
  if (low > 0) verdict = "regressed";
  return { change: median(head) / median(base) - 1, low, high, verdict };
};
