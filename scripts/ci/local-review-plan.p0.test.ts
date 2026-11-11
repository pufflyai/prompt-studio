import { expect, test } from "bun:test";
import { createLocalReviewPlan } from "./local-review-plan";

const packages: Parameters<typeof createLocalReviewPlan>[0]["packages"] = [
  { name: "producer", dir: "packages/producer", dependencies: [], scripts: { lint: "bun check" } },
  { name: "consumer", dir: "extensions/consumer", dependencies: ["producer"], scripts: { typecheck: "bun check" } },
  { name: "other", dir: "packages/other", dependencies: [], scripts: {} },
  { name: "e2e", dir: "packages/e2e", dependencies: ["producer"], scripts: {} },
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

test("covers changed producers and dependent source contracts without unrelated owners", () => {
  const result = plan(["packages/producer/src/rule.ts"]);
  expect(result.selected.map((entry) => entry.file)).toEqual(tests.slice(0, 3));
  expect(result.packageChecks.map((check) => check.id)).toEqual(["producer:lint", "consumer:typecheck"]);
  expect(result.deferred.some((entry) => entry.file === tests[4])).toBe(true);
});

test("helper changes select consuming behavior tests even when no test was edited", () => {
  expect(plan(["packages/producer/src/test-helper.ts"]).selected.map((entry) => entry.file)).toContain(tests[1]);
});

test("an edited browser scenario runs through its registered runner", () => {
  const result = plan([tests[5]!]);
  expect(result.selected.map((entry) => entry.file)).toContain(tests[5]);
  expect(result.runs.find((run) => run.files.includes(tests[5]!))?.command).toEqual([
    "bun",
    "run",
    "test:ui",
    "src/ui/feature.p2.spec.ts",
  ]);
});

test("benchmarks stay complete in CI and never masquerade as local passes", () => {
  const result = plan([tests[6]!]);
  expect(result.selected.some((entry) => entry.file === tests[6])).toBe(false);
  expect(result.deferred).toContainEqual(expect.objectContaining({ file: tests[6], evidence: "edited_tests" }));
});

test("documentation selects only documentation checks", () => {
  const result = plan(["documentation/guidance/0005-testing.md"]);
  expect(result.selected).toEqual([]);
  expect(result.packageChecks).toEqual([]);
  expect(result.setup).toEqual([]);
  expect(result.staticChecks.map((check) => check.id)).toEqual(["docs-links"]);
});

test("root inputs select all owners and deleted files still select their former owner", () => {
  expect(plan(["bun.lock"]).affectedOwners).toContain("other");
  expect(plan(["packages/producer/src/deleted.ts"]).affectedOwners).toContain("consumer");
});

test("explicit behavior selection is additive and rejects missing tests", () => {
  expect(plan(["documentation/example.md"], [tests[5]!]).selected.map((entry) => entry.file)).toEqual([tests[5]!]);
  expect(() => plan([], ["does-not-exist.p1.test.ts"])).toThrow("Unknown test");
});

test("startup changes select the existing app smoke and its build prerequisites", () => {
  const result = plan(["packages/pstdio-dashboard/src/main.tsx"]);
  expect(result.selected.map((entry) => entry.file)).toContain(tests[4]);
  expect(result.setup.flatMap((check) => check.command)).toContain("--concurrency");
});

test("affected unedited breadth and benchmarks remain visible as required CI evidence", () => {
  const result = plan(["packages/producer/src/rule.ts"]);
  expect(result.deferred).toContainEqual(
    expect.objectContaining({ file: tests[5], evidence: "ci:full diagnostics required" }),
  );
  expect(result.deferred).toContainEqual(
    expect.objectContaining({ file: tests[6], evidence: "complete benchmark diagnostics required" }),
  );
});

test("global preload and test runners cover every consumer without manifest dependencies", () => {
  for (const file of ["scripts/test-setup.ts", "scripts/ci/run-bun-tests.ts", "scripts/release/stage-package.ts"]) {
    expect(plan([file]).selected.map((entry) => entry.file)).toContain(tests[3]);
  }
});
