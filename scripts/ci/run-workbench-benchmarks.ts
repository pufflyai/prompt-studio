import { join, resolve } from "node:path";
import { runOrderedBrowserBenchmarks } from "./ordered-browser-benchmarks";

const root = resolve(import.meta.dir, "../..");
const cwd = join(root, "packages/e2e");
const files = process.argv.slice(2).map((file) => file.replace(/^\.\//, ""));
if (files.some((file) => !/^src\/perf\/[\w.-]+\.bench\.ts$/.test(file)) || new Set(files).size !== files.length)
  throw new Error("Choose each workbench benchmark file once; execution flags are not allowed");
process.exitCode = runOrderedBrowserBenchmarks({
  root,
  cwd,
  owner: "packages/e2e",
  runner: "workbench-benchmark",
  label: "workbench",
  files: files.map((file) => `packages/e2e/${file}`),
  command: ["src/scripts/run-playwright.ts", "-c", "playwright.perf.config.ts", ...files],
  reportPath: join(cwd, "test-results/workbench-benchmarks.json"),
  quarantinePath: join(cwd, "test-results/workbench-benchmarks-quarantine.json"),
});
