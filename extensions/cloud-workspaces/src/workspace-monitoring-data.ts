import type { WorkspaceActivity, WorkspaceCount } from "./workspace-history";

const millisecondsPerHour = 3_600_000;

export interface MonitoringWindow {
  from: number;
  to: number;
}

export const parseRate = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

export const parseDefaultRate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return parseRate(Number(value));
};

export function parseRates(value: unknown) {
  const rates = new Map<string, number>();
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return rates;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return rates;
  for (const [template, rate] of Object.entries(value)) {
    const parsed = parseRate(rate);
    if (parsed !== undefined) rates.set(template, parsed);
  }
  return rates;
}

export function estimateUsage(runtimeMs: number | null, hourlyUsd: number | undefined) {
  const costUsd = runtimeMs === 0 ? 0 : null;
  if (runtimeMs === null || hourlyUsd === undefined) return { runtimeMs, costUsd };
  return { runtimeMs, costUsd: (runtimeMs / millisecondsPerHour) * hourlyUsd };
}

export function workspaceUsage(
  readyAt: string | null | undefined,
  terminalAt: string | null | undefined,
  { from, to }: MonitoringWindow,
  terminal: boolean,
) {
  if (readyAt === null) return 0;
  if (!readyAt || (terminal && !terminalAt)) return null;
  const start = Date.parse(readyAt);
  const end = terminalAt ? Date.parse(terminalAt) : to;
  if (!Number.isFinite(start) || !Number.isFinite(end) || (terminalAt && end < start)) return null;
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

function integrate(points: readonly WorkspaceCount[], buckets: readonly MonitoringWindow[]) {
  let index = 0;
  return buckets.map(({ from, to }) => {
    let duration = 0;
    while (index + 1 < points.length) {
      const point = points[index];
      const next = points[index + 1];
      if (point.time >= to) break;
      duration += point.count * Math.max(0, Math.min(next.time, to) - Math.max(point.time, from));
      if (next.time > to) break;
      index += 1;
    }
    return duration;
  });
}

function usageTotals(runtimeMs: number, pricedRuntimeMs: number, costUsd: number) {
  return {
    runtimeMs,
    costUsd: runtimeMs === 0 || pricedRuntimeMs > 0 ? costUsd : null,
    unpricedRuntimeMs: Math.max(0, runtimeMs - pricedRuntimeMs),
  };
}

export function monitoringActivity(
  activity: WorkspaceActivity,
  rates: ReadonlyMap<string, number>,
  { from, to }: MonitoringWindow,
  bucketCount: number,
  defaultRate?: number,
) {
  const edge = (index: number) => from + Math.round(((to - from) * index) / bucketCount);
  const windows = Array.from({ length: bucketCount }, (_, index) => ({ from: edge(index), to: edge(index + 1) }));
  const totalRuntime = integrate(activity.points, windows);
  if (defaultRate !== undefined && [...rates.values()].every((rate) => rate === defaultRate)) {
    const valued = (runtimeMs: number) => ({
      ...estimateUsage(runtimeMs, defaultRate),
      runtimeMs,
      unpricedRuntimeMs: 0,
    });
    return {
      usage: valued(totalRuntime.reduce((total, duration) => total + duration, 0)),
      buckets: windows.map((bounds, index) => ({ ...bounds, ...valued(totalRuntime[index]) })),
    };
  }
  const pricedRuntime = Array<number>(bucketCount).fill(0);
  const cost = Array<number>(bucketCount).fill(0);

  for (const { template, points } of activity.byTemplate ?? []) {
    const rate = rates.get(template) ?? defaultRate;
    if (rate === undefined) continue;
    for (const [index, duration] of integrate(points, windows).entries()) {
      pricedRuntime[index] += duration;
      cost[index] += (duration / millisecondsPerHour) * rate;
    }
  }

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  return {
    usage: usageTotals(sum(totalRuntime), sum(pricedRuntime), sum(cost)),
    buckets: windows.map((bounds, index) => ({
      ...bounds,
      ...usageTotals(totalRuntime[index], pricedRuntime[index], cost[index]),
    })),
  };
}
