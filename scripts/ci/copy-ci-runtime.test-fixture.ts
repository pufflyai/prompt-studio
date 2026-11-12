import { copyFile, cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Nested executions own their selection, identity and reports. They must not join
// the enclosing hosted job's peer gate or consume its package assignment.
export const isolateCiRuntimeEnvironment = () => {
  const keys = [
    "CI_PLAN_JOB",
    "CI_PLAN_OUTPUT_DIR",
    "CI_TEST_EXECUTION_ID",
    "CI_PROFILE",
    "GITHUB_ACTIONS",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_JOB",
  ];
  const inherited = keys.map((key) => [key, process.env[key]] as const);
  for (const key of keys) delete process.env[key];
  return () => {
    for (const [key, value] of inherited) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
};

export const copyCiRuntime = async (root: string) => {
  await cp(import.meta.dirname, join(root, "scripts/ci"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
  await copyFile(join(import.meta.dirname, "../test.ts"), join(root, "scripts/test.ts"));
  // Test planning reads the shared suite registry, including in these isolated checkouts.
  const benchmarkPackage = join(import.meta.dirname, "../../packages/benchmarks");
  const source = join(root, "packages/benchmarks");
  await mkdir(source, { recursive: true });
  await copyFile(join(benchmarkPackage, "package.json"), join(source, "package.json"));
  await cp(join(benchmarkPackage, "src"), join(source, "src"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
};
