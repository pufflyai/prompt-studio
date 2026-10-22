import { scenarios } from "./contract";
import type { Workload } from "./fixture";

export interface ScenarioResult {
  profile: string;
  background: string;
  temperature: string;
  operation: string;
  sample: number;
  passed: boolean;
}
const key = (row: Omit<ScenarioResult, "passed">) =>
  JSON.stringify([row.profile, row.background, row.temperature, row.operation, row.sample]);

export const coverage = (kind: Workload, samples: ScenarioResult[]) => {
  const required = scenarios(kind);
  const byKey = new Map<string, ScenarioResult[]>();
  for (const sample of samples) byKey.set(key(sample), [...(byKey.get(key(sample)) ?? []), sample]);
  const missing = required.filter((row) => !byKey.has(key(row)));
  const duplicate = [...byKey].filter(([, rows]) => rows.length !== 1).map(([id]) => id);
  const failed = samples.filter((row) => !row.passed);
  return {
    passed: missing.length === 0 && duplicate.length === 0 && failed.length === 0,
    required: required.length,
    measured: samples.length,
    missing,
    duplicate,
    failed,
  };
};
