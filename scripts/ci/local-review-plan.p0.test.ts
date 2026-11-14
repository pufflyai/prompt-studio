import { expect, test } from "bun:test";
import { createLocalReviewPlan } from "./local-review-plan";

const packages: Parameters<typeof createLocalReviewPlan>[0]["packages"] = [
  { name: "producer", dir: "packages/producer", dependencies: [], scripts: { lint: "bun check" } },
  { name: "consumer", dir: "extensions/consumer", dependencies: ["producer"], scripts: { typecheck: "bun check" } },
  { name: "other", dir: "packages/other", dependencies: [], scripts: {} },
  { name: "e2e", dir: "packages/e2e", dependencies: ["producer"], scripts: { "test:smoke": "bun smoke.ts" } },
];
const tests = [
  "packages/producer/src/rule.p0.test.ts",
  "packages/producer/src/lifecycle.p1.test.ts",
  "extensions/consumer/src/contract.p1.test.ts",
  "packages/other/src/rule.p0.test.ts",
  "packages/e2e/src/ui/startup.p1.spec.ts",
  "packages/e2e/src/ui/feature.p2.spec.ts",
  "packages/producer/src/throughput.p3.bench.ts",
];
const plan = (changed: string[], additionalTests: string[] = []) =>
  createLocalReviewPlan({ packages, tests, changed, additionalTests });

test("always covers queue contracts, including unchanged owners", () => {
  const result = plan(["packages/producer/src/rule.ts"]);
  expect(result.selected.map((entry) => entry.file)).toEqual(tests.slice(0, 5));
  expect(result.packageChecks.map((check) => check.id)).toEqual(["producer:lint", "consumer:typecheck"]);
  expect(result.testPlan.runs.find((run) => run.smoke)?.files).toEqual([tests[4]!]);
});

test("helper changes select consuming behavior tests even when no test was edited", () => {
  expect(plan(["packages/producer/src/test-helper.ts"]).selected.map((entry) => entry.file)).toContain(tests[1]);
});

test("an edited browser scenario runs through its registered runner", () => {
  const result = plan([tests[5]!]);
  expect(result.selected.map((entry) => entry.file)).toContain(tests[5]);
  expect(result.testPlan.runs.find((run) => run.files.includes(tests[5]!))?.runner).toBe("app");
});

test("benchmarks stay complete in CI and never masquerade as local passes", () => {
  const result = plan([tests[6]!]);
  expect(result.selected.some((entry) => entry.file === tests[6])).toBe(false);
  expect(result.deferred).toContainEqual(expect.objectContaining({ file: tests[6], evidence: "edited_tests" }));
});

test("invoking review for documentation still preserves the queue baseline", () => {
  const result = plan(["documentation/guidance/0005-testing.md"]);
  expect(result.selected.map((entry) => entry.file)).toEqual([tests[0]!, tests[3]!, tests[4]!]);
  expect(result.packageChecks.map((check) => check.id)).toEqual(["producer:lint", "consumer:typecheck"]);
  expect(result.setup.length).toBeGreaterThan(0);
  expect(result.staticChecks.map((check) => check.id)).toEqual(["docs-links"]);
});

test("root inputs select all owners and deleted files still select their former owner", () => {
  expect(plan(["bun.lock"]).affectedOwners).toContain("other");
  expect(plan(["packages/producer/src/deleted.ts"]).affectedOwners).toContain("consumer");
});

test("explicit behavior selection is additive and rejects missing tests", () => {
  expect(plan(["documentation/example.md"], [tests[5]!]).selected.map((entry) => entry.file)).toEqual([
    tests[0]!,
    tests[3]!,
    tests[4]!,
    tests[5]!,
  ]);
  expect(() => plan([], ["does-not-exist.p1.test.ts"])).toThrow("Unknown test");
});

test("startup changes select the existing app smoke and its build prerequisites", () => {
  const result = plan(["packages/pstdio-dashboard/src/main.tsx"]);
  expect(result.selected.map((entry) => entry.file)).toContain(tests[4]);
  expect(result.setup.flatMap((check) => check.command)).toContain("--concurrency");
});

test("affected unedited breadth remains visible without requiring full PR matrices", () => {
  const result = plan(["packages/producer/src/rule.ts"]);
  expect(result.deferred).toContainEqual(
    expect.objectContaining({ file: tests[5], evidence: "nightly/release coverage; exceptional diagnostics only" }),
  );
  expect(result.deferred).toContainEqual(
    expect.objectContaining({ file: tests[6], evidence: "nightly/release benchmarks; exceptional diagnostics only" }),
  );
});

test("global preload and test runners cover every consumer without manifest dependencies", () => {
  for (const file of ["scripts/test-setup.ts", "scripts/ci/run-bun-tests.ts", "scripts/release/stage-package.ts"]) {
    expect(plan([file]).selected.map((entry) => entry.file)).toContain(tests[3]);
  }
});

test("all fast queue units remain mandatory for a narrow change", () => {
  const queuePackages = [
    ...packages,
    { name: "pstdio-api", dir: "packages/pstdio-api", dependencies: [], scripts: {} },
    { name: "pstdio-db", dir: "packages/pstdio-db", dependencies: [], scripts: {} },
    { name: "manager", dir: "services/manager", dependencies: [], scripts: { "test:integration": "bun isolated.ts" } },
  ];
  const queueFiles = [
    "root.p0.test.ts",
    "packages/pstdio-api/src/auth.p0.test.ts",
    "packages/pstdio-db/src/data.p0.test.ts",
    "services/manager/src/authority.p0.integration.ts",
  ];
  const result = createLocalReviewPlan({
    packages: queuePackages,
    tests: [...tests, ...queueFiles],
    changed: ["packages/other/src/change.ts"],
  });
  for (const file of queueFiles) {
    expect(result.selected.some((entry) => entry.file === file)).toBe(true);
    expect(result.testPlan.runs.some((run) => run.files.includes(file))).toBe(true);
    expect(result.deferred.some((entry) => entry.file === file)).toBe(false);
  }
  expect(result.testPlan.runs.find((run) => run.runner === "integration")?.files).toEqual([queueFiles[3]!]);
});
