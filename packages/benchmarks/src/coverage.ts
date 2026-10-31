import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { BenchmarkSuite, SuiteContext } from "./suite-types";

interface SuiteFiles {
  id: string;
  files: readonly string[];
}

const benchmarkNameError = (file: string) => {
  if (/\.(perf|stress)(\.fixture)?\.ts$/.test(file))
    return `${file} must use .p3.bench.ts for a benchmark or .diagnostic.ts for an investigation.`;
  if (file.endsWith(".bench.ts") && !file.endsWith(".p3.bench.ts"))
    return `${file} must declare the P3 priority as .p3.bench.ts.`;
};

export const benchmarkCoverageErrors = (files: string[], suites: SuiteFiles[]) => {
  const available = new Set(files);
  const owners = new Map<string, string[]>();
  const errors: string[] = [];
  for (const suite of suites) {
    for (const file of suite.files) {
      if (!file.endsWith(".p3.bench.ts")) errors.push(`Suite ${suite.id} names a non-benchmark: ${file}`);
      else if (!available.has(file)) errors.push(`Suite ${suite.id} names a missing benchmark: ${file}`);
      const assigned = owners.get(file) ?? [];
      assigned.push(suite.id);
      owners.set(file, assigned);
    }
  }
  for (const file of files) {
    const namingError = benchmarkNameError(file);
    if (namingError) {
      errors.push(namingError);
      continue;
    }
    if (!file.endsWith(".bench.ts")) continue;
    const assigned = owners.get(file) ?? [];
    if (!assigned.length)
      errors.push(`${file} is not tracked. Add it to a suite in packages/benchmarks/src/suites.ts.`);
    else if (assigned.length > 1) errors.push(`${file} is tracked by multiple suites: ${assigned.join(", ")}`);
  }
  return errors;
};

export const benchmarkExecutionErrors = (context: SuiteContext, suites: BenchmarkSuite[]) =>
  suites.flatMap((suite) => {
    const selected = new Set(
      suite
        .sample(context, suite.files)
        .flatMap((step) => step.command.map((argument) => resolve(context.root, step.cwd ?? ".", argument))),
    );
    return suite.files
      .filter((file) => !selected.has(resolve(context.root, file)))
      .map((file) => `Suite ${suite.id} does not execute its registered benchmark: ${file}`);
  });

export const verifyBenchmarkCoverage = (root: string, suites: BenchmarkSuite[]) => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => existsSync(join(root, file)));
  const errors = [
    ...benchmarkCoverageErrors(files, suites),
    ...benchmarkExecutionErrors(
      { root, cacheDir: join(root, "__test-tmp__"), sha: "coverage", platform: "linux-x64" },
      suites,
    ),
  ];
  if (errors.length) throw new Error(`Benchmark coverage failed:\n${errors.join("\n")}`);
};
