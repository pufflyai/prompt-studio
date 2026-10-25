import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { partitionFocusedFiles, selectFocusedTestFiles } from "./focused-test-files";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = (paths: string[]) => {
  const root = mkdtempSync(join(tmpdir(), "focused-tests-"));
  roots.push(root);
  for (const path of paths) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(
      join(root, path),
      path.endsWith(".test.ts") ? 'import { test } from "bun:test"; test("behavior", () => {});' : "export {};\n",
    );
  }
  for (const args of [
    ["init", "--quiet"],
    ["add", "."],
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  }
  return root;
};

test("partitions large selections deterministically without losing, repeating, or emptying file rows", () => {
  const files = Array.from({ length: 403 }, (_, index) => `src/feature-${index}.test.ts`);
  const rows = partitionFocusedFiles(files, 4, 100);
  expect(rows).toHaveLength(4);
  expect(rows.map((row) => row.length)).toEqual([101, 101, 101, 100]);
  expect(rows.flat().sort()).toEqual([...files].sort());
  expect(new Set(rows.flat()).size).toBe(files.length);
  expect(partitionFocusedFiles([...files].reverse(), 4, 100)).toEqual(rows);
  expect(files[0]).toBe("src/feature-0.test.ts");
  expect(partitionFocusedFiles(files, 3, 100).map((row) => row.length)).toEqual([135, 134, 134]);
});

test("small focused selections use one row and empty selections use none", () => {
  expect(partitionFocusedFiles([], 4, 100)).toEqual([]);
  expect(partitionFocusedFiles(["src/b.test.ts", "src/a.test.ts"], 4, 100)).toEqual([
    ["src/a.test.ts", "src/b.test.ts"],
  ]);
  expect(
    partitionFocusedFiles(
      Array.from({ length: 101 }, (_, index) => `${index}.test.ts`),
      4,
      100,
    ),
  ).toHaveLength(2);
});

test("partitions sequential database files into smaller exhaustive rows within its existing shard cap", () => {
  const files = Array.from({ length: 67 }, (_, index) => `src/db/feature-${index}.test.ts`);
  const rows = partitionFocusedFiles(files, 3, 25);
  expect(rows.map((row) => row.length)).toEqual([23, 22, 22]);
  expect(rows.flat().sort()).toEqual([...files].sort());
  expect(new Set(rows.flat()).size).toBe(67);
  expect(partitionFocusedFiles([...files].reverse(), 3, 25)).toEqual(rows);
  expect(partitionFocusedFiles(files.slice(0, 25), 3, 25)).toHaveLength(1);
});

test("selects directly adjacent maintained tests and changed tests without unrelated neighbors", () => {
  const root = fixture([
    "packages/api/src/features/workspaces/create.ts",
    "packages/api/src/features/workspaces/create.test.ts",
    "packages/api/src/features/workspaces/create.test.tsx",
    "packages/api/src/features/workspaces/delete.test.ts",
  ]);
  expect(
    selectFocusedTestFiles(root, "packages/api", ["packages/api/src/features/workspaces/create.ts"]).files,
  ).toEqual(["src/features/workspaces/create.test.ts", "src/features/workspaces/create.test.tsx"]);
  expect(
    selectFocusedTestFiles(root, "packages/api", ["packages/api/src/features/workspaces/delete.test.ts"]).files,
  ).toEqual(["src/features/workspaces/delete.test.ts"]);
});

test("walks to the nearest owning directory and excludes fixture helpers and untracked tests", () => {
  const root = fixture([
    "packages/api/src/features/workspaces/internal/create.ts",
    "packages/api/src/features/workspaces/create.test.ts",
    "packages/api/src/features/workspaces/test-helpers.test.ts",
    "packages/api/src/features/sessions/create.test.ts",
  ]);
  writeFileSync(join(root, "packages/api/src/features/workspaces/untracked.test.ts"), "");
  const result = selectFocusedTestFiles(root, "packages/api", [
    "packages/api/src/features/workspaces/internal/create.ts",
  ]);
  expect(result.files).toEqual(["src/features/workspaces/create.test.ts"]);
  expect(result.reason).toContain("src/features/workspaces");
});

test("falls back visibly to all maintained package tests for shared owner changes", () => {
  const root = fixture([
    "packages/api/package.json",
    "packages/api/src/app.ts",
    "packages/api/src/features/a/a.test.ts",
    "packages/api/src/features/b/b.test.ts",
  ]);
  const result = selectFocusedTestFiles(root, "packages/api", ["packages/api/src/app.ts"]);
  expect(result.files).toEqual(["src/features/a/a.test.ts", "src/features/b/b.test.ts"]);
  expect(result.reason).toContain("whole-package fallback");
});

test("selects no PR database tests for consumer-only or package documentation changes", () => {
  const root = fixture(["packages/api/README.md", "packages/api/src/app.test.ts"]);
  expect(selectFocusedTestFiles(root, "packages/api", ["packages/sdk/src/client.ts"]).files).toEqual([]);
  expect(selectFocusedTestFiles(root, "packages/api", ["packages/api/README.md"]).files).toEqual([]);
});

test("does not mistake a sibling feature's tests for a new feature's owner", () => {
  const root = fixture([
    "packages/api/src/features/new-feature/create.ts",
    "packages/api/src/features/other/create.test.ts",
    "packages/api/src/app.test.ts",
  ]);
  const result = selectFocusedTestFiles(root, "packages/api", ["packages/api/src/features/new-feature/create.ts"]);
  expect(result.reason).toContain("whole-package fallback");
  expect(result.files).toEqual(["src/app.test.ts", "src/features/other/create.test.ts"]);
});
