import { expect, test } from "bun:test";
import { quarantineGroups, quarantineTestCommand } from "./run-quarantined-tests";

test("Windows Playwright quarantine preserves its configured allowance instead of Bun's fixture override", () => {
  const files = ["src/e2e/packaged-launch.p3.bench.ts"];
  expect(
    quarantineTestCommand("packaged-desktop-benchmark", "@pstdio/desktop", "test:benchmark", files, "win32"),
  ).toEqual(["bun", "run", "test:benchmark", `./${files[0]}`]);
  expect(quarantineTestCommand("packaged-desktop", "@pstdio/desktop", "test:packaged", files, "win32")).not.toContain(
    "--timeout=15000",
  );
  expect(quarantineTestCommand("bun", "harness-pi", "test", files, "win32")).toContain("--timeout=15000");
  expect(quarantineTestCommand("bun", "@pstdio/desktop", "test", files, "win32")).toContain("--timeout=15000");
  expect(quarantineTestCommand("bun", "@pstdio/desktop", "test", files, "linux")).not.toContain("--timeout=15000");
});

const packages = [
  { name: "database", dir: "packages/db", dependencies: [] },
  { name: "planner", dir: "extensions/planner", dependencies: [] },
];
const entries = [
  { runner: "bun", file: "packages/db/a.p1.test.ts", name: "db", platforms: ["win32"] },
  { runner: "bun", file: "extensions/planner/stack.p0.test.ts", name: "stack", platforms: ["win32"] },
  { runner: "bun", file: "packages/db/native.p1.test.ts", name: "native", platforms: ["darwin"], arch: "x64" },
];
test("a new quarantine owner joins its platform lane without another workflow list", () => {
  expect(quarantineGroups(entries, packages, "bun", "win32", "x64").map((g) => g.owner.name)).toEqual([
    "database",
    "planner",
  ]);
  expect(quarantineGroups(entries, packages, "bun", "linux", "x64")).toEqual([]);
  expect(quarantineGroups(entries, packages, "bun", "darwin", "arm64")).toEqual([]);
  expect(quarantineGroups(entries, packages, "bun", "win32", "x64", "planner")[0]?.entries[0]?.name).toBe("stack");
  expect(() => quarantineGroups(entries, packages, "bun", "win32", "x64", "missing")).toThrow();
});
