import { expect, test } from "bun:test";
import { scopeFixture } from "./ci-scope.test-fixture";
import { createEditedTestMatrix, editedTestFiles } from "./edited-test-matrix";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs } from "./required-ci-jobs";
import { evaluateCiGate } from "./test-policy";

test("edited native desktop tests retain every stable desktop platform", () => {
  const file = "clients/desktop/src/e2e/packaged-recovery.p2.spec.ts";
  const rows = createEditedTestMatrix([file], [{ name: "@pstdio/desktop", dir: "clients/desktop", dependencies: [] }]);
  expect(rows.map((row) => row.platform).sort()).toEqual(["darwin", "darwin", "linux", "win32"]);
  expect(rows.every((row) => JSON.parse(row.files).includes(file))).toBe(true);
});

test("source and packaged desktop checks have distinct required result identities", () => {
  const files = ["clients/desktop/src/e2e/recovery.p1.spec.ts", "clients/desktop/src/e2e/packaged-recovery.p1.spec.ts"];
  const rows = createEditedTestMatrix(files, [{ name: "@pstdio/desktop", dir: "clients/desktop", dependencies: [] }]);
  expect(rows).toHaveLength(8);
  expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
});

test("edited packaged CLI tests retain all six native toolchains without duplicate shard rows", () => {
  const file = "packages/e2e/src/packaged/install.p1.test.ts";
  const rows = createEditedTestMatrix([file], scopeFixture().packages);
  expect(rows).toHaveLength(6);
  expect(new Set(rows.map((row) => `${row.platform}-${row.arch}`)).size).toBe(6);
});

test("P0 unit tests already checked by PR CI are not executed twice", () => {
  expect(createEditedTestMatrix(["packages/example/src/value.p0.test.ts"], scopeFixture().packages)).toEqual([]);
});

test("edited benchmarks select their registered suite once and preserve its cold workload", () => {
  const files = ["packages/e2e/src/perf/nav-chrome.p3.bench.ts", "packages/e2e/src/perf/side-panel.p3.bench.ts"];
  const rows = createEditedTestMatrix(files, scopeFixture().packages);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ suite: "workbench", priority: "P3", files: JSON.stringify(files) });
  expect(() => createEditedTestMatrix(["packages/e2e/src/perf/unknown.p3.bench.ts"], scopeFixture().packages)).toThrow(
    "no registered suite",
  );
});

test("test fixture edits select their owner tests and deleted tests are not scheduled", () => {
  const input = scopeFixture();
  const selected = editedTestFiles(
    input.tests,
    ["packages/e2e/src/ui/helpers/camera.ts", "removed.p2.spec.ts"],
    input.packages,
  );
  expect(selected).toEqual(input.tests.filter((file) => file.startsWith("packages/e2e/")).sort());
});

test("the required PR gate cannot pass when an edited-test result is missing or fails", () => {
  const input = scopeFixture();
  const scope = resolveCiScope({ ...input, changedFiles: ["packages/e2e/src/ui/feature.p2.spec.ts"] });
  const plan = plannedCiJobs(scope);
  const observed = plan.flatMap((job) =>
    job.names!.map((name) => ({ name, status: "completed", conclusion: "success" })),
  );
  expect(evaluateCiGate(plan, observed, false, true).outcome).toBe("success");
  expect(
    evaluateCiGate(
      plan,
      observed.filter((job) => !job.name.startsWith("edited_tests (")),
      false,
      true,
    ).outcome,
  ).toBe("failure");
  expect(
    evaluateCiGate(
      plan,
      observed.map((job) => ({
        ...job,
        conclusion: job.name.startsWith("edited_tests (") ? "failure" : job.conclusion,
      })),
      false,
      true,
    ).outcome,
  ).toBe("failure");
});
