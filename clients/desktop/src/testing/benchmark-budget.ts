export interface BenchmarkMetric {
  name: string;
  unit: "ms" | "share" | "percent";
  value: number;
  budget: number;
}

// A missing measurement fails like an exceeded budget; it never passes as zero.
export const findBudgetFailures = (metrics: BenchmarkMetric[]) => {
  if (!metrics.length) return ["No measurements were recorded"];
  return metrics.flatMap(({ name, unit, value, budget }) => {
    if (!Number.isFinite(value)) return [`${name} was not measured`];
    if (value >= budget) return [`${name} measured ${value} ${unit}, not below its ${budget} ${unit} budget`];
    return [];
  });
};
