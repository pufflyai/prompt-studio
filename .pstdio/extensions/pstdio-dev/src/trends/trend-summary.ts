import type { MetricKey, TrendMetric } from "../benchmarks/analysis";

export const metricId = (metric: Pick<MetricKey, "suite" | "metric">) => `${metric.suite}/${metric.metric}`;

export const versionSummary = (metrics: TrendMetric[], index: number) => {
  const measured = metrics.flatMap((metric) => {
    const point = metric.points[index];
    return point ? [{ metric, point }] : [];
  });
  return {
    improved: measured.filter(({ point }) => point.change?.verdict === "improved").length,
    regressed: measured.filter(({ point }) => point.change?.verdict === "regressed").length,
    overBudget: measured.filter(({ metric, point }) => metric.budget !== undefined && point.median >= metric.budget)
      .length,
    budgeted: measured.filter(({ metric }) => metric.budget !== undefined).length,
  };
};

export interface SuiteGroup<T extends MetricKey> {
  suite: string;
  label: string;
  metrics: T[];
}

export const groupBySuite = <T extends MetricKey>(metrics: T[]) => {
  const groups = new Map<string, SuiteGroup<T>>();
  for (const metric of metrics) {
    const group = groups.get(metric.suite) ?? {
      suite: metric.suite,
      label: metric.suiteLabel,
      metrics: [],
    };
    group.metrics.push(metric);
    groups.set(metric.suite, group);
  }
  return [...groups.values()];
};

// Keeps only the chosen versions, in release order. No choice means every version.
export const pickVersions = (versions: string[], metrics: TrendMetric[], chosen?: string[]) => {
  if (!chosen) return { versions, metrics };
  const kept = versions.flatMap((version, index) => (chosen.includes(version) ? [index] : []));
  return {
    versions: kept.map((index) => versions[index]),
    metrics: metrics.map((metric) => ({ ...metric, points: kept.map((index) => metric.points[index]) })),
  };
};
