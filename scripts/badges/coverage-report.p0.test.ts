import { expect, test } from "bun:test";
import { coverageReport } from "./coverage-report";

test("lists unimported production files without inventing executable line counts", () => {
  const report = coverageReport({
    root: "/repo",
    revision: "a".repeat(40),
    scope: "daily-production/linux-x64",
    measuredAt: "2026-10-25T00:00:00Z",
    workflowRunId: 200,
    trackedFiles: [
      "packages/api/src/imported.ts",
      "packages/api/src/unimported.ts",
      "packages/api/src/helper.test-fixture.ts",
      "packages/api/src/typed.generated.ts",
      "packages/api/src/__generated__/types.ts",
      "packages/api/src/example.stories.tsx",
      "packages/api/src/app.p1.test.ts",
      "packages/api/src/types.d.ts",
      "packages/storybook-tests/src/ui/example.spec.ts",
      "packages/workbench-fixture/src/index.ts",
    ],
    reports: [
      { packageDir: "/repo/packages/api", content: "SF:src/imported.ts\nDA:1,1\nDA:2,0" },
      { packageDir: "/repo/packages/sdk", content: "SF:../api/src/imported.ts\nDA:1,2\nDA:2,0" },
    ],
  });
  expect(report).toMatchObject({
    revision: "a".repeat(40),
    scope: "daily-production/linux-x64",
    workflowRunId: 200,
    source: {
      coveredLines: 1,
      totalLines: 2,
      importedFiles: ["packages/api/src/imported.ts"],
      unimportedFiles: ["packages/api/src/unimported.ts"],
    },
    execution: { state: "not-provided" },
  });
});

test("keeps missing, quarantined and non-instrumented cases separate from source coverage", () => {
  const report = coverageReport({
    root: "/repo",
    revision: "b".repeat(40),
    scope: "production",
    measuredAt: "now",
    trackedFiles: [],
    reports: [],
    execution: [
      {
        revision: "b".repeat(40),
        stage: "production",
        platform: "windows-x64",
        priority: "P2",
        quarantined: true,
        selectedCaseIds: ["browser/dialog", "compiled/startup"],
        cases: [{ id: "browser/dialog", outcome: "success" }],
      },
    ],
  });
  expect(report.source).toMatchObject({ coveredLines: 0, totalLines: 0 });
  expect(report.execution).toMatchObject({
    state: "provided",
    reports: [
      {
        stage: "production",
        platform: "windows-x64",
        priority: "P2",
        quarantined: true,
        selected: 2,
        completed: 1,
        missingCaseIds: ["compiled/startup"],
        outcome: "incomplete",
      },
    ],
  });
});

test("does not certify duplicate, unexpected or wrong-revision case evidence", () => {
  const result = coverageReport({
    root: "/repo",
    revision: "current",
    scope: "production",
    measuredAt: "now",
    trackedFiles: [],
    reports: [],
    execution: [
      {
        revision: "older",
        stage: "merge_queue",
        platform: "linux-x64",
        priority: "P1",
        quarantined: false,
        selectedCaseIds: ["required"],
        cases: [
          { id: "required", outcome: "success" },
          { id: "required", outcome: "success" },
          { id: "other", outcome: "success" },
        ],
      },
    ],
  });
  expect(result.execution.reports[0]).toMatchObject({
    outcome: "incomplete",
    revisionMatches: false,
    duplicateCaseIds: ["required"],
    unexpectedCaseIds: ["other"],
  });
});
