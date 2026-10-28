import type { Change } from "../benchmarks/analysis";
import type { BenchmarkUnit } from "../benchmarks/result-file";
import type { Verdict } from "../benchmarks/stats";

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

export const formatValue = (value: number, unit: BenchmarkUnit) => {
  if (unit === "bytes") {
    const power = Math.min(BYTE_UNITS.length - 1, Math.max(0, Math.floor(Math.log10(Math.max(value, 1)) / 3)));
    return `${(value / 1000 ** power).toFixed(power ? 1 : 0)} ${BYTE_UNITS[power]}`;
  }
  if (unit === "share") return `${(value * 100).toFixed(value < 0.1 ? 2 : 1)}%`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  if (value >= 100) return `${Math.round(value)} ms`;
  if (value >= 1) return `${value.toFixed(1)} ms`;
  return `${value.toFixed(3)} ms`;
};

export const formatRange = (low: number, high: number, unit: BenchmarkUnit) =>
  `${formatValue(low, unit)} – ${formatValue(high, unit)}`;

export const formatPercent = (share: number) => {
  if (!Number.isFinite(share)) return "up from 0";
  return `${share >= 0 ? "+" : "−"}${Math.abs(share * 100).toFixed(1)}%`;
};

export const formatChangeRange = (change: Change) => `${formatPercent(change.low)} to ${formatPercent(change.high)}`;

// Memory is not faster or slower, so its verdicts name the direction instead.
const verdictWords: Record<"time" | "memory", Record<Verdict, string>> = {
  time: { improved: "faster", regressed: "slower", unchanged: "no change" },
  memory: { improved: "less memory", regressed: "more memory", unchanged: "no change" },
};

export const verdictWord = (verdict: Verdict, unit: BenchmarkUnit) =>
  verdictWords[unit === "bytes" ? "memory" : "time"][verdict];

export const verdictArrow: Record<Verdict, string> = { improved: "↓", regressed: "↑", unchanged: "≈" };

// Status colors carry an arrow and a word, never color alone.
export const verdictPalette: Record<Verdict, string> = { improved: "green", regressed: "red", unchanged: "gray" };
export const verdictColor: Record<Verdict, string> = {
  improved: "fg.success",
  regressed: "fg.error",
  unchanged: "fg.muted",
};

export const verdictText = (change: Change, unit: BenchmarkUnit) => {
  const word = verdictWord(change.verdict, unit);
  if (change.verdict === "unchanged") return `${verdictArrow.unchanged} ${word}`;
  if (!Number.isFinite(change.change)) return `${verdictArrow[change.verdict]} ${word}, up from 0`;
  return `${verdictArrow[change.verdict]} ${Math.abs(change.change * 100).toFixed(1)}% ${word}`;
};

export const shortSha = (sha: string) => sha.slice(0, 7);
