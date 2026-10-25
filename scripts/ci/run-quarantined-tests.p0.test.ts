import { expect, test } from "bun:test";
import { quarantineGroups } from "./run-quarantined-tests";

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
