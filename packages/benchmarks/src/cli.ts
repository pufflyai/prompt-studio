import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { verifyBenchmarkCoverage } from "./coverage";
import { type Checkout, run } from "./run";
import { currentPlatform, findSuites, prepareSuite, sampleSuite } from "./steps";
import { suiteIds, suites } from "./suites";

const usage = `Usage:
  bun src/cli.ts run --checkout <dir>=<sha>[=<ref>]... --suites <ids> --samples <n> --out <dir>
  bun src/cli.ts describe [--platform <platform>]
  bun src/cli.ts prepare --suites <ids> --sha <sha> --cache <dir>
  bun src/cli.ts sample --suite <id> --sha <sha> --cache <dir> --out <file>`;

const repoRoot = resolve(import.meta.dir, "../../..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    checkout: { type: "string", multiple: true },
    suites: { type: "string", default: suiteIds.join(",") },
    suite: { type: "string" },
    samples: { type: "string", default: "1" },
    sha: { type: "string", default: "" },
    cache: { type: "string", default: join(repoRoot, "__test-tmp__", "benchmarks") },
    out: { type: "string", default: "benchmark-results" },
    platform: { type: "string", default: currentPlatform() },
  },
});

// CI passes --platform only to describe, to plan the jobs of other runners from one machine.
const platform = values.platform;
const context = () => ({ root: repoRoot, cacheDir: resolve(values.cache), platform, sha: values.sha });
const listOf = (value: string | undefined) => (value ?? "").split(",").filter(Boolean);

const parseCheckout = (value: string): Checkout => {
  const [dir, sha, ref] = value.split("=");
  if (!dir || !sha) throw new Error(`Expected --checkout <dir>=<sha>[=<ref>], got ${value}`);
  return { dir: resolve(dir), sha, ...(ref ? { ref } : {}) };
};

const command = positionals[0];
if (command === "verify") {
  verifyBenchmarkCoverage(repoRoot, suites);
  console.log("Every benchmark belongs to exactly one suite.");
} else if (command === "describe") {
  const available = findSuites(suiteIds, platform);
  console.log(JSON.stringify(available.map(({ id, label, files }) => ({ id, label, source: files.join(", ") }))));
} else if (command === "prepare") {
  let passed = true;
  for (const suite of findSuites(listOf(values.suites), platform))
    passed = (await prepareSuite(context(), suite)) && passed;
  if (!passed) process.exitCode = 1;
} else if (command === "sample") {
  const [suite] = findSuites(listOf(values.suite), platform);
  if (!suite) throw new Error(usage);
  if (!(await sampleSuite(context(), suite, resolve(values.out)))) process.exitCode = 1;
} else if (command === "run") {
  if (process.env.CI && Number(values.samples) !== 1) throw new Error("CI executes each benchmark once");
  const failures = await run({
    checkouts: (values.checkout ?? []).map(parseCheckout),
    suites: listOf(values.suites),
    samples: Number(values.samples),
    out: resolve(values.out),
    cache: resolve(values.cache),
    platform,
  });
  // A failed sample keeps the measurements it recorded; the run still fails so CI shows it.
  if (failures.length) {
    console.error(`Failed steps:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
} else {
  console.error(usage);
  process.exitCode = 1;
}
