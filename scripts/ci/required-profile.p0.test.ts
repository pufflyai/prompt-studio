import { expect, test } from "bun:test";
import { scopeFixture } from "./ci-scope.test-fixture";
import { createCiTestPlan } from "./ci-test-plan";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs } from "./required-ci-jobs";

const source = { sha: "candidate", tree: "merged-tree", policy: "policy", dirty: false };
test("PR and queue run the same required profile for the same combined change scope", () => {
  const input = scopeFixture();
  input.tests.push("clients/desktop/src/e2e/packaged-app.p1.spec.ts");
  input.packages.push({ name: "@pstdio/desktop", dir: "clients/desktop", dependencies: ["example"] });
  const pr = resolveCiScope(input);
  const queue = resolveCiScope({ ...input, event: "merge_group" });
  expect(plannedCiJobs(pr)).toEqual(plannedCiJobs(queue));
  const packages = input.packages.map((pkg) => ({ ...pkg, scripts: {} }));
  const selections = (scope: typeof pr) =>
    createCiTestPlan(scope, packages, input.tests, source).runs.map(({ reasons: _reasons, ...run }) => run);
  expect(selections(pr)).toEqual(selections(queue));
  expect(pr.clientMatrix.map((row) => row.target)).toEqual(["linux-x64"]);
  expect(plannedCiJobs(pr).map((job) => job.id)).toContain("build_clients");
  expect(pr.windows).toBe(false);
});

test("a narrow change still runs all fast P0 units while contracts follow affected production owners", () => {
  const input = scopeFixture();
  input.tests.push("packages/unrelated/src/fast.p0.test.ts", "packages/unrelated/src/contract.p1.test.ts");
  input.packages.push({ name: "unrelated", dir: "packages/unrelated", dependencies: [] });
  const scope = resolveCiScope(input);
  const plan = createCiTestPlan(
    scope,
    input.packages.map((pkg) => ({ ...pkg, scripts: {} })),
    input.tests,
    source,
  );
  const files = plan.runs.flatMap((run) => run.files);
  expect(files).toContain("packages/unrelated/src/fast.p0.test.ts");
  expect(files).not.toContain("packages/unrelated/src/contract.p1.test.ts");
  expect(files).toContain("packages/pstdio-api/src/isolation.p1.test.ts");
});
