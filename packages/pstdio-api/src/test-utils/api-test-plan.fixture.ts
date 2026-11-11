import { shardTestFiles } from "pstdio-scripts/testing";

interface PlanOptions {
  files?: string[];
  shard?: string;
  timings?: Record<string, number>;
}
const normalize = (path: string) => path.replaceAll("\\", "/").replace(/^\.\//, "");

export const createApiTestPlan = (discovered: string[], options: PlanOptions = {}) => {
  const available = [...new Set(discovered.map(normalize))].sort();
  const selected = options.files?.map(normalize).sort() ?? available;
  if (!selected.length) throw new Error("API test selection is empty");
  if (new Set(selected).size !== selected.length) throw new Error("Duplicate API test selection");
  for (const file of selected) if (!available.includes(file)) throw new Error(`Unknown API test file: ${file}`);
  return shardTestFiles(selected, options);
};
