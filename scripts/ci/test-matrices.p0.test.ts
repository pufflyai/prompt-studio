import { expect, test } from "bun:test";
import { createTestMatrices } from "./test-matrices";

const packages = [
  { name: "pstdio-api", dir: "packages/pstdio-api", dependencies: [] },
  { name: "pstdio-dashboard", dir: "packages/pstdio-dashboard", dependencies: [] },
  { name: "@pstdio/ui", dir: "packages/ui", dependencies: [] },
  { name: "canvas-tests", dir: "packages/canvas-tests", dependencies: [] },
  { name: "e2e", dir: "packages/e2e", dependencies: [] },
];
const files = [
  "packages/pstdio-api/src/state.p0.test.ts",
  "packages/pstdio-api/src/isolation.p1.test.ts",
  "packages/canvas-tests/src/ui/ui/menu.p1.spec.ts",
  "packages/canvas-tests/src/ui/pstdio-dashboard/navigation.p1.spec.ts",
  "packages/canvas-tests/src/ui/ui/menu-permutations.p2.spec.ts",
  "packages/e2e/src/ui/startup.p1.spec.ts",
  "packages/e2e/src/ui/session.p1.spec.ts",
  "packages/e2e/src/ui/feature.p2.spec.ts",
];

test("queue matrices keep priority rows separate and exclude production permutations", () => {
  const plan = createTestMatrices(
    files,
    packages,
    packages.map((pkg) => pkg.name),
    ["P0", "P1"],
  );
  expect(plan.databaseMatrix.map((row) => row.priority)).toEqual(["P0", "P1"]);
  expect(plan.componentMatrix.every((row) => row.priority === "P1")).toBe(true);
  expect(plan.appMatrix.every((row) => row.priority === "P1")).toBe(true);
  expect(JSON.stringify(plan)).not.toContain("permutations");
  expect(JSON.stringify(plan)).not.toContain("feature.p2");
});

test("component builds follow affected workspace owners and discover new tests automatically", () => {
  const plan = createTestMatrices(
    [...files, "packages/canvas-tests/src/ui/ui/new-control.p1.spec.ts"],
    packages,
    ["@pstdio/ui"],
    ["P0", "P1"],
  );
  expect(plan.componentMatrix).toHaveLength(1);
  expect(plan.componentMatrix[0]?.package).toBe("ui");
  expect(JSON.parse(plan.componentMatrix[0]!.files)).toContain("src/ui/ui/new-control.p1.spec.ts");
});

test("production adds P2 as its own rows without changing the critical selection", () => {
  const plan = createTestMatrices(
    files,
    packages,
    packages.map((pkg) => pkg.name),
    ["P0", "P1", "P2"],
  );
  expect(plan.componentMatrix.some((row) => row.priority === "P2")).toBe(true);
  expect(plan.appMatrix.some((row) => row.priority === "P2")).toBe(true);
});

test("every affected integration owner gets a priority row without a filename list", () => {
  const plan = createTestMatrices(
    [...files, "packages/pstdio-api/src/automations.p1.integration.ts"],
    packages,
    ["pstdio-api"],
    ["P0", "P1"],
  );
  expect(plan).toHaveProperty("integrationMatrix", [{ package: "pstdio-api", priority: "P1" }]);
});
