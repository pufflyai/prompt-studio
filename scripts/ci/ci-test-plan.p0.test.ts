import { expect, test } from "bun:test";
import { createCiTestPlan } from "./ci-test-plan";
import { resolveCiScope } from "./pull-request-ci-scope";
import { projectCiJobs } from "./test-matrices";
import { selectLocalTests } from "./test-selection";

const source = { sha: "candidate", tree: "tree", policy: "policy", dirty: false };
const packages = ["pstdio-db", "pstdio-api", "other"].map((name) => ({
  name,
  dir: `packages/${name}`,
  dependencies: [],
  scripts: {},
}));
const tests = [
  "packages/pstdio-db/src/db.p0.test.ts",
  "packages/pstdio-api/src/api.p0.test.ts",
  "packages/other/src/value.p0.test.ts",
];
test("database owners execute exactly once even when their package row contains no ordinary Bun work", () => {
  const scope = resolveCiScope({
    event: "pull_request",
    changedFiles: ["packages/pstdio-db/src/db.ts"],
    packages,
    tests,
  });
  const plan = createCiTestPlan(scope, packages, tests, source);
  expect(plan.runs.flatMap((run) => run.files)).toEqual([tests[0]!]);
  expect(Object.values(projectCiJobs(plan)).flat()).toEqual(plan.runs.map((run) => run.id));
});

test("the ordinary local default retains separately scheduled native, packaged and integration work as explicit requests", () => {
  const deferred = [
    "clients/desktop/src/e2e/source.p1.spec.ts",
    "packages/e2e/src/packaged/start.p1.test.ts",
    "services/relay/src/storage.p1.integration.ts",
  ];
  expect(selectLocalTests([...tests, ...deferred], false)).toEqual(tests);
  expect(selectLocalTests(deferred, true)).toEqual(deferred);
});
