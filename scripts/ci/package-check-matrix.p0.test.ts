import { expect, test } from "bun:test";
import { partitionPackageChecks } from "./package-check-matrix";

test("package rows cover every selected owner exactly once with balanced sizes", () => {
  const selected = Array.from({ length: 41 }, (_, index) => `package-${index.toString().padStart(2, "0")}`);
  const rows = partitionPackageChecks(selected);
  expect(rows.map((row) => row.shard)).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  expect(rows.map((row) => row.packages.length)).toEqual([11, 10, 10, 10]);
  expect(rows.flatMap((row) => row.packages).sort()).toEqual(selected);
  for (const row of rows) expect(row.lernaFilter).toBe(row.packages.map((name) => `--scope ${name}`).join(" "));
});

test("package partitions are deterministic and do not repeat duplicate owners", () => {
  expect(partitionPackageChecks(["z", "a", "b", "a"])).toEqual(partitionPackageChecks(["b", "a", "z"]));
  expect(partitionPackageChecks(["z", "a", "b"]).map((row) => row.shard)).toEqual(["1/3", "2/3", "3/3"]);
  expect(partitionPackageChecks(["owner"])[0]?.packages).toEqual(["owner"]);
  expect(partitionPackageChecks([])).toEqual([]);
});
