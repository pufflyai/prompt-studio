import { findBudgetFailures, subnavBudgets } from "pstdio-benchmarks";
import type { SubnavSample } from "./subnav-benchmark-clock";

type Sample = Pick<SubnavSample, "destination" | "visit" | "structureMs" | "dataMs" | "editorMs">;

export const subnavBenchmarkResults = (samples: Sample[], sampleCount: number) => {
  const order = ["ticket/first", "sessions/first", "ticket/repeat", "sessions/repeat"];
  if (
    samples.length !== sampleCount * order.length ||
    samples.some((sample, index) => `${sample.destination}/${sample.visit}` !== order[index % order.length])
  )
    throw new Error("Navigation benchmark must contain every ordered measurement exactly once");
  const budgetErrors: string[] = [];
  const specs = order.flatMap((group) => {
    const rows = samples.filter((sample) => `${sample.destination}/${sample.visit}` === group);
    const metrics = [
      { key: "structureMs", name: "structure", budget: subnavBudgets.structureMs.value },
      { key: "dataMs", name: "data", budget: subnavBudgets.dataMs.value },
      ...(group.startsWith("ticket/")
        ? [{ key: "editorMs", name: "editor", budget: subnavBudgets.editorMs.value }]
        : []),
    ];
    return metrics.map((metric) => {
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
            results: [
              { status: failures.length ? "failed" : "passed", errors: failures.map((message) => ({ message })) },
            ],
          },
        ],
      };
    });
  });
  return { specs, budgetErrors };
};
