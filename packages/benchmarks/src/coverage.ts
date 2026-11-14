import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import ts from "typescript";
import { approvedCatalog, readContract } from "./catalog/contract";
import { scenarios } from "./catalog/scenarios";
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
      errors.push(
        `${file} is not authorized by the frozen catalog. A human instruction and protected approval are required.`,
      );
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

const literalArgument = (argument: ts.Expression | undefined) =>
  argument && ts.isStringLiteral(argument) ? argument.text : undefined;

export const verifyBenchmarkCoverage = async (root: string, suites: BenchmarkSuite[]) => {
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
  if (scenarios.length !== 8 || scenarios.some((scenario, index) => scenario.id !== `B${index + 1}`))
    errors.push("The frozen catalog is exactly B1–B8 in order");
  for (const scenario of scenarios) {
    const source = ts.createSourceFile(
      scenario.file,
      readFileSync(join(root, scenario.file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const cases: string[] = [];
    const visit = (node: ts.Node) => {
      if (!ts.isCallExpression(node)) {
        ts.forEachChild(node, visit);
        return;
      }
      {
        const name = node.expression.getText(source);
        const id = literalArgument(node.arguments[0]);
        if (name === "runScenario") cases.push(id ?? "dynamic-case");
        if (/^(test|it|describe)(\.|$)/.test(name))
          errors.push(`${scenario.file}: extra test/case registration is forbidden`);
        if (name.endsWith(".record") && id && !scenario.metrics.some((metric) => metric.id === id))
          errors.push(`${scenario.file}: undeclared metric ${id}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (JSON.stringify(cases) !== JSON.stringify([scenario.id]))
      errors.push(`${scenario.file}: expected exactly one ${scenario.id} case`);
  }
  if (errors.length) throw new Error(`Benchmark coverage failed:\n${errors.join("\n")}`);
  const { digest } = readContract(root);
  await approvedCatalog(digest);
  console.log(`Human-approved frozen catalog revision 1: ${digest}`);
};
