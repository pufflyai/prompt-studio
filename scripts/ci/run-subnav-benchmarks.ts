import { join, resolve } from "node:path";
import { runOrderedBrowserBenchmarks } from "./ordered-browser-benchmarks";

if (process.env.BENCHMARK_SAMPLES && process.env.BENCHMARK_SAMPLES !== "30")
  throw new Error("Production navigation requires all thirty samples per destination and visit");
const root = resolve(import.meta.dir, "../..");
const cwd = join(root, "packages/e2e");
process.exitCode = runOrderedBrowserBenchmarks({
  root,
  cwd,
  owner: "packages/e2e",
  runner: "subnav-benchmark",
  label: "navigation contracts",
  files: ["packages/e2e/src/perf/subnav.p3.bench.ts"],
  command: ["src/perf/subnav.p3.bench.ts"],
  reportPath: join(cwd, "test-results/subnav-benchmarks.json"),
  quarantinePath: join(cwd, "test-results/subnav-benchmarks-quarantine.json"),
});
