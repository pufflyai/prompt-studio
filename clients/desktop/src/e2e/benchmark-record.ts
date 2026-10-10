import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { resolvePackagedLayout } from "../packaging/package-layout";
import { type BenchmarkMetric, findBudgetFailures } from "../testing/benchmark-budget";

const desktopRoot = resolve(import.meta.dirname, "../..");
const packageLayout = resolvePackagedLayout(desktopRoot, process.platform, process.arch);
let sidecarSha256: string | undefined;

export interface Benchmark {
  name: string;
  scenario: string;
  workload: string;
  measuredProcess: string;
  start: string;
  end: string;
  metrics: BenchmarkMetric[];
}

// Attaches every sample with the source, artifact, and runner identity before checking budgets,
// so a failed budget still leaves comparable evidence. Every metric must be below its budget.
export const recordBenchmark = async (benchmark: Benchmark) => {
  sidecarSha256 ??= createHash("sha256").update(readFileSync(packageLayout.sidecar)).digest("hex");
  await test.info().attach(`benchmark-${benchmark.name}.json`, {
    contentType: "application/json",
    body: JSON.stringify(
      {
        ...benchmark,
        revision: execFileSync("git", ["describe", "--always", "--dirty", "--abbrev=40"], {
          cwd: desktopRoot,
          encoding: "utf8",
        }).trim(),
        artifact: {
          root: packageLayout.root,
          sidecarSha256,
        },
        environment: {
          platform: process.platform,
          arch: process.arch,
          cpu: cpus()[0]?.model,
          parallelism: availableParallelism(),
          ci: Boolean(process.env.CI),
          runner: process.env.RUNNER_NAME,
        },
      },
      null,
      2,
    ),
  });
  expect(findBudgetFailures(benchmark.metrics), benchmark.name).toEqual([]);
};
