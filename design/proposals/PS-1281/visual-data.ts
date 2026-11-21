import type { Condition } from "./fixtures";

export type WindowRange = "1h" | "24h" | "7d";
export type VisualSection = "Overview" | "Sync" | "Storage" | "Infrastructure" | "Failures";
export interface SeriesPoint {
  time: number;
  value: number | null;
  series: string;
}
export interface Panel {
  id: string;
  title: string;
  kind: "line" | "area" | "bar" | "capacity";
  unit: string;
}

export const panels: Panel[] = [
  { id: "latency", title: "Request latency", kind: "line", unit: "ms" },
  { id: "errors", title: "Request failures", kind: "bar", unit: "requests" },
  { id: "storage", title: "Stored data", kind: "area", unit: "GiB" },
  { id: "resources", title: "CPU and memory", kind: "line", unit: "%" },
  { id: "cleanup", title: "Expired cleanup backlog", kind: "area", unit: "MiB" },
  { id: "live", title: "Live delivery latency", kind: "line", unit: "ms" },
  { id: "capacity", title: "Capacity and headroom", kind: "capacity", unit: "%" },
  { id: "ingestion", title: "Observation age", kind: "line", unit: "seconds" },
];

const visible: Record<VisualSection, string[]> = {
  Overview: ["latency", "errors", "storage", "resources", "cleanup", "capacity"],
  Sync: ["latency", "live", "errors", "ingestion"],
  Storage: ["storage", "capacity", "cleanup", "ingestion"],
  Infrastructure: ["resources", "capacity", "ingestion", "latency"],
  Failures: ["errors", "latency", "cleanup", "ingestion"],
};
export const panelsFor = (section: VisualSection) => panels.filter((panel) => visible[section].includes(panel.id));
export const hoursFor = (range: WindowRange) => ({ "1h": 1, "24h": 24, "7d": 168 })[range];
export const ageLabel = (hours: number) => (hours === 0 ? "Now" : `${Math.abs(hours).toFixed(1)}h ago`);
export const observedTime = (hours: number) => new Date(Date.UTC(2026, 10, 21, 18) + hours * 3_600_000).toISOString();

const valuesFor = (id: string, index: number, failing: boolean): [string, number][] => {
  const wave = Math.sin(index / 2) * 0.5 + 0.5;
  const incident = failing && index > 19;
  switch (id) {
    case "latency":
      return [
        ["p50", 85 + wave * 30],
        ["p95", 190 + wave * 70 + (incident ? 900 : 0)],
        ["p99", 310 + wave * 110 + (incident ? 1400 : 0)],
      ];
    case "errors":
      return [
        ["5xx", incident ? 18 + Math.round(wave * 12) : 0],
        ["429", index === 9 ? 4 : 0],
        ["Other 4xx", index % 5 === 0 ? 2 : 0],
      ];
    case "storage":
      return [
        ["Blobs", 15 + index * 0.035],
        ["Updates and states", 3 + index * 0.008],
      ];
    case "resources":
      return [
        ["CPU", 14 + wave * 12 + (incident ? 12 : 0)],
        ["Memory", 38 + index * 0.15],
      ];
    case "cleanup":
      return [["Eligible for deletion", incident ? 64 + (index - 19) * 18 : Math.max(0, 14 - index * 2)]];
    case "live":
      return [
        ["p50", 48 + wave * 15],
        ["p95", 80 + wave * 35],
      ];
    case "ingestion":
      return [
        ["Metrics", 15 + wave * 12],
        ["Probes", 20 + wave * 30],
      ];
    default:
      return [];
  }
};

export const seriesFor = (
  panel: Panel,
  condition: Condition,
  range: WindowRange,
  environment: string,
): SeriesPoint[] => {
  const multiplier = environment === "Staging" ? 0.6 : 1;
  if (panel.kind === "capacity")
    return [
      ["Account quota", 38],
      ["Database pool", 32],
      ["Memory", 41],
      ["Probe budget", 12],
    ].map(([series, value]) => ({
      time: 0,
      series: String(series),
      value: condition === "stale" ? null : Number(value) * multiplier,
    }));
  return Array.from({ length: 24 }, (_, index) =>
    valuesFor(panel.id, index, condition === "storage-failure").map(([series, value]) => ({
      time: -hoursFor(range) + (index * hoursFor(range)) / 23,
      series,
      value: condition === "stale" && index > 20 ? null : value * multiplier,
    })),
  ).flat();
};

export const healthIntervals = (condition: Condition, range: WindowRange) =>
  ["HTTP", "Access", "Sync", "Blobs", "Live"].flatMap((check) =>
    Array.from({ length: 24 }, (_, index) => {
      let state = "Healthy";
      if (condition === "storage-failure" && ["Sync", "Blobs"].includes(check) && index > 19) state = "Failing";
      if (condition === "stale" && index > 20) state = "Unknown";
      const start = -hoursFor(range) + (index * hoursFor(range)) / 24;
      return { check, state, start, end: start + hoursFor(range) / 24 };
    }),
  );
