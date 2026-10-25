import { expect, test } from "bun:test";
import { browserArguments, selectedComponentFiles } from "./run-browser";

test("component browser failures stop only P1 and preserve selected specs", () => {
  expect(browserArguments(["src/ui/menu-dialog.spec.ts"], "P1")).toEqual([
    "test",
    "src/ui/menu-dialog.spec.ts",
    "--max-failures=1",
  ]);
  for (const priority of ["P0", "P2", "P3"]) {
    expect(browserArguments(["--shard=2/3"], priority)).toEqual(["test", "--shard=2/3", "--max-failures=0"]);
  }
});

test("selected component JSON becomes exact process arguments alongside shard options", () => {
  expect(browserArguments(["--shard=1/1"], "P1", JSON.stringify(["src/ui/menu-dialog.spec.ts"]))).toEqual([
    "test",
    "src/ui/menu-dialog.spec.ts",
    "--shard=1/1",
    "--max-failures=1",
  ]);
});

test("empty, missing, duplicate and argument-like component selections fail before launching", () => {
  for (const files of [
    [],
    ["--grep=.*"],
    ["../ui/menu-dialog.spec.ts"],
    ["src/ui/missing.spec.ts"],
    ["src/ui/menu-dialog.spec.ts", "src/ui/menu-dialog.spec.ts"],
    { file: "src/ui/menu-dialog.spec.ts" },
  ])
    expect(() => selectedComponentFiles(JSON.stringify(files))).toThrow();
});
