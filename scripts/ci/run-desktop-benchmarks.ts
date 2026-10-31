import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { runOrderedBrowserBenchmarks } from "./ordered-browser-benchmarks";

const root = resolve(import.meta.dir, "../..");
const cwd = join(root, "clients/desktop");
const files = process.argv.slice(2).map((file) => file.replace(/^\.\//, ""));
if (files.some((file) => !/^(?:\.\/)?src\/e2e\/[\w.-]+\.bench\.ts$/.test(file)) || new Set(files).size !== files.length)
  throw new Error("Choose each desktop benchmark file once; execution flags are not allowed");
const command = ["x", "--no-install", "playwright", "test", "--config", "playwright.benchmark.config.ts", ...files];
// Retain the focused quarantine runner for diagnosis; normal CI uses the ordered complete execution below.
if (process.env.E2E_TEST_LANE === "quarantine") {
  const child = spawnSync(process.execPath, command, { cwd, stdio: "inherit" });
  process.exit(child.status ?? 1);
}
process.exitCode = runOrderedBrowserBenchmarks({
  root,
  cwd,
  owner: "clients/desktop",
  runner: "packaged-desktop-benchmark",
  label: "desktop",
  files: files.map((file) => `clients/desktop/${file}`),
  command,
  reportPath: join(cwd, "test-results/packaged-benchmarks.json"),
  quarantinePath: join(cwd, "test-results/packaged-benchmarks-quarantine.json"),
});
