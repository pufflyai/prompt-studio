import { findBudgetFailures, subnavBudgets } from "pstdio-benchmarks";
import type { SubnavSample } from "./subnav-benchmark-clock";
import { classifySubnavRequests } from "./subnav-request-outcomes";

export const subnavBenchmarkCases = {
  "ticket/first": { metrics: ["structureMs"], requests: true },
  "sessions/first": { metrics: ["structureMs", "dataMs"], requests: true },
  "ticket/repeat": { metrics: ["dataMs", "editorMs"], requests: true },
  "sessions/repeat": { metrics: ["structureMs", "dataMs"], requests: false },
};

type Sample = Pick<SubnavSample, "destination" | "visit" | "structureMs" | "dataMs" | "editorMs" | "requests">;

export const subnavBenchmarkResults = (samples: Sample[], sampleCount: number) => {
  const order = Object.keys(subnavBenchmarkCases) as (keyof typeof subnavBenchmarkCases)[];
  if (
    samples.length !== sampleCount * order.length ||
    samples.some((sample, index) => `${sample.destination}/${sample.visit}` !== order[index % order.length])
  )
    throw new Error("Navigation benchmark must contain every ordered measurement exactly once");
  const budgetErrors: string[] = [];
  const requestErrors: string[] = [];
  const specs = order.flatMap((group) => {
    const rows = samples.filter((sample) => `${sample.destination}/${sample.visit}` === group);
    const metrics = [
      { key: "structureMs", name: "structure", budget: subnavBudgets.structureMs.value },
      { key: "dataMs", name: "data", budget: subnavBudgets.dataMs.value },
      { key: "editorMs", name: "editor", budget: subnavBudgets.editorMs.value },
    ].filter((metric) => subnavBenchmarkCases[group].metrics.includes(metric.key));
    const metricSpecs = metrics.map((metric) => {
      const title = `${group} ${metric.name}`;
      const values = rows.map((row) => row[metric.key as "structureMs" | "dataMs" | "editorMs"]);
      if (values.some((value) => value === undefined || !Number.isFinite(value) || value < 0))
        throw new Error(`Invalid navigation measurement: ${title}`);
      const failures = findBudgetFailures(
        values.map((value) => ({ name: title, unit: "ms", value: value!, budget: metric.budget })),
      );
      budgetErrors.push(...failures);
      return {
        title,
        file: "src/perf/subnav.p3.bench.ts",
        tests: [
          {
            annotations: failures.map((message) => ({ type: "performance-budget-failure", description: message })),
            results: [
              { status: failures.length ? "failed" : "passed", errors: failures.map((message) => ({ message })) },
            ],
          },
        ],
      };
    });
    if (!subnavBenchmarkCases[group].requests) return metricSpecs;
    const failures = rows.flatMap((row) =>
      classifySubnavRequests(row.requests).errors.map((request) => `${group}: ${JSON.stringify(request)}`),
    );
    requestErrors.push(...failures);
    return [
      ...metricSpecs,
      {
        title: `${group} requests`,
        file: "src/perf/subnav.p3.bench.ts",
        tests: [
          {
            annotations: [],
            results: [
              { status: failures.length ? "failed" : "passed", errors: failures.map((message) => ({ message })) },
            ],
          },
        ],
      },
    ];
  });
  return { specs, budgetErrors, requestErrors };
};
