import { expect, test } from "bun:test";
import { createPriorityPlan } from "./priority-plan";

const packages: Parameters<typeof createPriorityPlan>[1] = [
  { name: "example", dir: "packages/example", dependencies: [], scripts: { test: "bun configured-runner.ts" } },
  { name: "pstdio-api", dir: "packages/pstdio-api", dependencies: [], scripts: { test: "bun runner.ts" } },
  { name: "e2e", dir: "packages/e2e", dependencies: [], scripts: {} },
  { name: "canvas-tests", dir: "packages/canvas-tests", dependencies: [], scripts: {} },
  { name: "@pstdio/ui", dir: "packages/ui", dependencies: [], scripts: {} },
];

test("local commands select exactly one priority while preserving owning package runners", () => {
  const plan = createPriorityPlan(
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
  expect(plan[0]?.command).toEqual(["bun", "run", "test", "./src/isolation.p1.test.ts"]);
  expect(plan[1]?.command).toEqual(["bun", "run", "test", '--files=["src/session.p1.test.ts"]']);
  expect(plan.every((run) => run.priority === "P1")).toBe(true);
});

test("component runs infer the Canvas preview owner from their directory", () => {
  const plan = createPriorityPlan(
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
    createPriorityPlan(
      plan.flatMap((run) => run.files),
      packages,
      "P1",
      { scope: "@pstdio/ui" },
    ).flatMap((run) => run.files),
  ).toEqual(["packages/canvas-tests/src/ui/ui/menu.p1.spec.ts"]);
});

test("scope and runner filters do not expand into unrelated tests", () => {
  const files = ["packages/example/src/value.p0.test.ts", "packages/pstdio-api/src/state.p0.test.ts"];
  expect(createPriorityPlan(files, packages, "P0", { scope: "example" }).flatMap((run) => run.files)).toEqual([
    files[0]!,
  ]);
  expect(createPriorityPlan(files, packages, "P0", { runner: "api" }).flatMap((run) => run.files)).toEqual([files[1]!]);
});

test("isolated integrations invoke one canonical owner script with the selected files", () => {
  const owner = {
    name: "relay",
    dir: "services/relay",
    dependencies: [],
    scripts: { "test:integration": "bun integration.ts", "test:isolated": "bun test-isolated.ts" },
  };
  const plan = createPriorityPlan(["services/relay/src/storage.p1.integration.ts"], [owner], "P1");
  expect(plan).toHaveLength(1);
  expect(plan[0]?.command).toEqual(["bun", "run", "test:integration", "src/storage.p1.integration.ts"]);
});
