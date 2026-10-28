import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import {
  type BenchmarkResultFile,
  type BenchmarkSuiteInfo,
  mergeSamples,
  RESULT_FORMAT,
  type SuiteSample,
} from "./result-file";
import { sampleOrder } from "./schedule";

export interface Checkout {
  dir: string;
  sha: string;
  ref?: string;
}

export interface RunOptions {
  checkouts: Checkout[];
  suites: string[];
  samples: number;
  out: string;
  cache: string;
  platform: string;
}

const packageDir = (checkout: Checkout) => join(checkout.dir, "packages", "benchmarks");

// Each commit runs its own copy of this CLI, so it is measured with the benchmarks it shipped with.
const bench = async (checkout: Checkout, args: string[]) => {
  const cwd = packageDir(checkout);
  if (!existsSync(cwd)) throw new Error(`${checkout.sha} predates the benchmark result format and cannot be measured.`);
  const child = Bun.spawn(["bun", "src/cli.ts", ...args], { cwd, stdio: ["ignore", "inherit", "inherit"] });
  return (await child.exited) === 0;
};

const describe = async (checkout: Checkout) => {
  const child = Bun.spawn(["bun", "src/cli.ts", "describe"], {
    cwd: packageDir(checkout),
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(await new Response(child.stdout).text()) as BenchmarkSuiteInfo[];
};

const githubRun = () => {
  const id = process.env.GITHUB_RUN_ID;
  if (!id) return {};
  return { run: { id, url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${id}` } };
};

const resultFile = (input: {
  checkout: Checkout;
  platform: string;
  startedAt: string;
  suites: BenchmarkSuiteInfo[];
  samples: SuiteSample[];
}): BenchmarkResultFile => {
  const metrics = mergeSamples(input.samples);
  return {
    format: RESULT_FORMAT,
    commit: { sha: input.checkout.sha, ...(input.checkout.ref ? { ref: input.checkout.ref } : {}) },
    platform: input.platform,
    runner: process.env.ImageOS ?? process.env.RUNNER_NAME ?? hostname(),
    ...githubRun(),
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    suites: input.suites.filter((suite) => metrics.some((metric) => metric.suite === suite.id)),
    metrics,
  };
};

export const run = async (options: RunOptions) => {
  const { checkouts, out } = options;
  const startedAt = new Date().toISOString();
  const cache = (checkout: Checkout) => join(options.cache, checkout.sha);
  const failures: string[] = [];
  const described = new Map<string, BenchmarkSuiteInfo[]>();
  for (const checkout of checkouts) {
    const suites = (await describe(checkout)).filter((suite) => options.suites.includes(suite.id));
    described.set(checkout.sha, suites);
    const ids = suites.map((suite) => suite.id).join(",");
    if (!(await bench(checkout, ["prepare", "--suites", ids, "--sha", checkout.sha, "--cache", cache(checkout)])))
      failures.push(`prepare on ${checkout.sha}`);
  }
  await mkdir(join(out, ".samples"), { recursive: true });
  const samples = new Map<string, SuiteSample[]>(checkouts.map((checkout) => [checkout.sha, []]));
  for (const { commit, sample } of sampleOrder(checkouts, options.samples)) {
    for (const suite of described.get(commit.sha) ?? []) {
      const file = join(out, ".samples", `${commit.sha}-${suite.id}-${sample}.jsonl`);
      await writeFile(file, "");
      const args = ["sample", "--suite", suite.id, "--sha", commit.sha, "--cache", cache(commit), "--out", file];
      if (!(await bench(commit, args))) failures.push(`${suite.id} sample ${sample + 1} on ${commit.sha}`);
      samples.get(commit.sha)?.push({ suite: suite.id, lines: await readFile(file, "utf8") });
    }
  }
  for (const checkout of checkouts) {
    const file = resultFile({
      checkout,
      platform: options.platform,
      startedAt,
      suites: described.get(checkout.sha) ?? [],
      samples: samples.get(checkout.sha) ?? [],
    });
    await writeFile(join(out, `${checkout.sha}-${options.platform}.json`), `${JSON.stringify(file, null, 2)}\n`);
  }
  return failures;
};
