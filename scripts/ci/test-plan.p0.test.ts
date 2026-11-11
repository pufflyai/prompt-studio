import { expect, test } from "bun:test";
import { createTestPlan, validateTestPlan } from "./test-plan";
import { reconcileTestResults } from "./verify-test-results";

const packages = [
  { name: "pstdio-dashboard", dir: "packages/pstdio-dashboard", dependencies: [], scripts: {} },
  { name: "pstdio-api", dir: "packages/pstdio-api", dependencies: [], scripts: {} },
];
const context = {
  source: { sha: "candidate", tree: "tree", policy: "policy", dirty: false },
  target: { platform: "linux", arch: "x64" },
  packages,
};
const files = ["packages/pstdio-api/src/session.p1.test.ts", "packages/pstdio-dashboard/src/state.p0.test.ts"];

test("a saved plan binds exact selection and shared setup to source and execution identity", () => {
  const plan = createTestPlan({ ...context, files });
  expect(plan.runs.flatMap((run) => run.files).sort()).toEqual([...files].sort());
  expect(new Set(plan.setup.map((step) => step.id)).size).toBe(plan.setup.length);
  expect(createTestPlan({ ...context, files: [...files].reverse() }).digest).toBe(plan.digest);
  expect(() => validateTestPlan({ ...plan, runs: [] })).toThrow("digest");
  expect(() => validateTestPlan(plan, { ...context.source, sha: "other" })).toThrow("source");
});

test("missing, duplicate, stale and incomplete run results cannot satisfy the plan", () => {
  const plan = createTestPlan({ ...context, files });
  const results = plan.runs.map((run) => ({
    runId: run.id,
    planDigest: plan.digest,
    source: plan.source,
    executionId: "attempt-1",
    outcome: "success" as const,
    complete: true,
    exitCode: 0,
    reports: [],
  }));
  expect(reconcileTestResults(plan, results, "attempt-1").outcome).toBe("success");
  for (const invalid of [
    results.slice(1),
    [...results, results[0]!],
    results.map((r) => ({ ...r, executionId: "old" })),
    results.map((r) => ({ ...r, complete: false })),
  ]) {
    expect(reconcileTestResults(plan, invalid, "attempt-1").outcome).toBe("failure");
  }
  const failed = results.map((r) => ({ ...r, outcome: "failure" as const, exitCode: 1 }));
  expect(reconcileTestResults(plan, failed, "attempt-1")).toMatchObject({ outcome: "failure", complete: true });
});

test("unrelated setup failures do not become prerequisites of source-only tests", () => {
  const plan = createTestPlan({
    ...context,
    packages: [...packages, { name: "@pstdio/desktop", dir: "clients/desktop", dependencies: [], scripts: {} }],
    files: [...files, "clients/desktop/src/e2e/packaged-window.p1.spec.ts"],
  });
  const dashboard = plan.runs.find((run) => run.owner === "pstdio-dashboard")!;
  const desktop = plan.setup.filter((step) => step.kind === "desktop").map((step) => step.id);
  expect(desktop.length).toBeGreaterThan(0);
  expect(dashboard.requires.some((id) => desktop.includes(id))).toBe(false);
});

test("shard and lane identities cannot share results", () => {
  const stable = createTestPlan({ ...context, files, shard: "1/2", lane: "stable" });
  const other = createTestPlan({ ...context, files, shard: "2/2", lane: "quarantine" });
  expect(stable.runs.some((run) => other.runs.some((candidate) => candidate.id === run.id))).toBe(false);
});

test("compatible browser inputs share preparation without depending on native compilation", () => {
  const plan = createTestPlan({
    ...context,
    packages: [...packages, { name: "e2e", dir: "packages/e2e", dependencies: [], scripts: {} }],
    files: ["packages/e2e/src/ui/source.p1.spec.ts", "packages/e2e/src/packaged/native.p1.test.ts"],
  });
  const fixtures = plan.setup.filter((step) => step.kind === "extension-fixtures");
  expect(fixtures).toHaveLength(1);
  expect(fixtures[0]!.requires.flatMap((id) => plan.setup.find((step) => step.id === id)!.owners)).toEqual([
    "@pstdio/sdk",
    "@pstdio/ui",
  ]);
  expect(plan.runs.every((run) => run.requires.includes(fixtures[0]!.id))).toBe(true);
});
