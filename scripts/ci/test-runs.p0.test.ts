import { expect, test } from "bun:test";
import { createTestRuns } from "./test-runs";

const packages: Parameters<typeof createTestRuns>[1] = [
  { name: "example", dir: "packages/example", dependencies: [], scripts: { test: "bun configured-runner.ts" } },
  { name: "pstdio-api", dir: "packages/pstdio-api", dependencies: [], scripts: { test: "bun runner.ts" } },
  { name: "e2e", dir: "packages/e2e", dependencies: [], scripts: {} },
  { name: "canvas-tests", dir: "packages/canvas-tests", dependencies: [], scripts: {} },
  { name: "@pstdio/ui", dir: "packages/ui", dependencies: [], scripts: {} },
];

test("local commands select exactly one priority while preserving owning package runners", () => {
  const plan = createTestRuns(
    [
      "packages/example/src/value.p0.test.ts",
      "packages/example/src/isolation.p1.test.ts",
      "packages/pstdio-api/src/session.p1.test.ts",
    ],
    packages,
    "P1",
  );
  expect(plan.map((run) => run.files)).toEqual([
    ["packages/example/src/isolation.p1.test.ts"],
    ["packages/pstdio-api/src/session.p1.test.ts"],
  ]);
  expect(plan[0]?.command).toContain("../../scripts/ci/run-bun-tests.ts");
  expect(plan[1]?.command).toContain("src/test-utils/run-api-tests.ts");
  expect(plan[1]?.command).toContain('--files=["src/session.p1.test.ts"]');
  expect(plan.every((run) => run.priority === "P1")).toBe(true);
});

test("component runs infer the Canvas preview owner from their directory", () => {
  const plan = createTestRuns(
    [
      "packages/canvas-tests/src/ui/ui/menu.p1.spec.ts",
      "packages/canvas-tests/src/ui/pstdio-workbench/tabs.p1.spec.ts",
      "packages/canvas-tests/src/ui/pstdio-dashboard/navigation.p2.spec.ts",
    ],
    packages,
    "P1",
  );
  expect(plan.map((run) => run.componentOwner)).toEqual(["pstdio-workbench", "ui"]);
  expect(plan.every((run) => run.files.length === 1)).toBe(true);
  expect(
    createTestRuns(
      plan.flatMap((run) => run.files),
      packages,
      "P1",
      { scope: "@pstdio/ui" },
    ).flatMap((run) => run.files),
  ).toEqual(["packages/canvas-tests/src/ui/ui/menu.p1.spec.ts"]);
});

test("scope and runner filters do not expand into unrelated tests", () => {
  const files = ["packages/example/src/value.p0.test.ts", "packages/pstdio-api/src/state.p0.test.ts"];
  expect(createTestRuns(files, packages, "P0", { scope: "example" }).flatMap((run) => run.files)).toEqual([files[0]!]);
  expect(createTestRuns(files, packages, "P0", { runner: "api" }).flatMap((run) => run.files)).toEqual([files[1]!]);
});

test("isolated integrations invoke one canonical owner script with the selected files", () => {
  const owner = {
    name: "pstdio-relay",
    dir: "services/relay",
    dependencies: [],
    scripts: { "test:integration": "bun integration.ts", "test:isolated": "bun test-isolated.ts" },
  };
  const plan = createTestRuns(["services/relay/src/storage.p1.integration.ts"], [owner], "P1");
  expect(plan).toHaveLength(1);
  expect(plan[0]?.command).toEqual([
    "bun",
    "../../scripts/ci/run-service-integrations.ts",
    "pstdio-relay",
    "src/storage.p1.integration.ts",
  ]);
});

test("P3 benchmark names keep browser and standalone files on their owning runners", () => {
  const browser = "packages/e2e/src/perf/nav-chrome.p3.bench.ts";
  const standalone = "packages/e2e/src/perf/subnav.p3.bench.ts";
  const plan = createTestRuns([browser, standalone], packages, "P3");
  expect(plan.find((run) => run.files.includes(browser))?.command).toEqual([
    "bun",
    "run",
    "perf:frontend",
    "src/perf/nav-chrome.p3.bench.ts",
  ]);
  expect(plan.find((run) => run.files.includes(standalone))?.command).toEqual(["bun", "src/perf/subnav.p3.bench.ts"]);
  expect(plan).toHaveLength(2);
});

test("a Playwright file whose cases are all quarantined here may select no stable cases", () => {
  const desktop = { name: "@pstdio/desktop", dir: "clients/desktop", dependencies: [], scripts: {} };
  const files = ["clients/desktop/src/e2e/packaged-app.p1.spec.ts", "packages/example/src/isolation.p1.test.ts"];
  const plan = createTestRuns(files, [...packages, desktop], "P1", { allowQuarantineOnly: true });
  expect(plan.find((run) => run.runner === "desktop")?.command.at(-1)).toBe("--pass-with-no-tests");
  expect(plan.find((run) => run.runner === "bun")?.command).not.toContain("--pass-with-no-tests");
  expect(createTestRuns(files, [...packages, desktop], "P1")[0]?.command).not.toContain("--pass-with-no-tests");
});
