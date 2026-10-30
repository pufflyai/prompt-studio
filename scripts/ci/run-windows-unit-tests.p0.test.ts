import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createWindowsUnitPlan } from "./run-windows-unit-tests";

const packages = ["one", "two", "three", "four", "pstdio-wt", "pstdio-api", "pstdio-db", "e2e", "canvas-tests"].map(
  (name) => ({ name, dir: `packages/${name}`, dependencies: [], scripts: { test: "bun runner.ts" } }),
);
const files = [
  "packages/one/src/one.p0.test.ts",
  "packages/two/src/two.p1.test.ts",
  "packages/three/src/three.p2.test.ts",
  "packages/four/src/four.p2.test.ts",
  "packages/pstdio-wt/src/git.p1.test.ts",
  "scripts/ci/check.p0.test.ts",
];

test("global Windows shards execute each file once without creating empty package shards", () => {
  const excluded = [
    "packages/pstdio-api/src/session.p1.test.ts",
    "packages/pstdio-db/src/db.p0.test.ts",
    "packages/e2e/src/helpers.p0.test.ts",
    "packages/canvas-tests/src/helpers.p0.test.ts",
    "packages/one/src/full.p3.test.ts",
    "packages/one/src/service.p2.integration.ts",
  ];
  const plans = Array.from({ length: 4 }, (_, index) =>
    createWindowsUnitPlan([...files, ...excluded], packages, `${index + 1}/4`),
  );
  const selected = plans.flatMap((plan) => plan.flatMap((run) => run.files));
  expect([...selected].sort()).toEqual([...files].sort());
  expect(new Set(selected).size).toBe(selected.length);
  expect(plans.every((plan) => plan.length > 0 && plan.every((run) => run.files.length > 0))).toBe(true);
  for (const run of plans.flat()) {
    expect(run.command.some((arg) => arg.startsWith("--shard"))).toBe(false);
    if (run.owner === "pstdio-wt") expect(run.command).not.toContain("--timeout=15000");
    else expect(run.command).toContain("--timeout=15000");
  }
});

test("global Windows shard selection is deterministic and rejects invalid or empty shards", () => {
  expect(createWindowsUnitPlan([...files].reverse(), packages, "1/4")).toEqual(
    createWindowsUnitPlan(files, packages, "1/4"),
  );
  for (const shard of ["0/4", "5/4", "1/0", "1", "1.5/4"])
    expect(() => createWindowsUnitPlan(files, packages, shard)).toThrow("shard");
  expect(() => createWindowsUnitPlan([], packages, "1/4")).toThrow("No Windows unit tests");
});

test("owner scripts execute only their assigned files across Windows unit shards", async () => {
  const root = await mkdtemp(join(tmpdir(), "windows-unit-selection-"));
  try {
    const dir = "packages/pstdio-sync";
    const manifest = JSON.parse(await readFile(resolve(import.meta.dir, "../../", dir, "package.json"), "utf8"));
    const cwd = join(root, dir);
    await mkdir(join(cwd, "src"), { recursive: true });
    await symlink(
      resolve(import.meta.dir, ".."),
      join(root, "scripts"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await writeFile(join(cwd, "package.json"), JSON.stringify({ scripts: { test: manifest.scripts.test } }));
    const files = [`${dir}/src/first.p0.test.ts`, `${dir}/src/second.p1.test.ts`];
    for (const [index, file] of files.entries())
      await writeFile(join(root, file), `import {test} from "bun:test"; test("case ${index}", () => {});`);
    for (const shard of ["1/2", "2/2"]) {
      const plan = createWindowsUnitPlan(
        files,
        [{ name: "pstdio-sync", dir, dependencies: [], scripts: manifest.scripts }],
        shard,
      );
      expect(plan).toHaveLength(1);
      const evidence = join(root, `evidence-${shard[0]}.json`);
      const child = Bun.spawn([process.execPath, ...plan[0]!.command.slice(1)], {
        cwd,
        env: { ...process.env, TEST_PRIORITIES: "P0,P1,P2", CI_PRIORITY: "P2", BUN_TEST_EVIDENCE_FILE: evidence },
        stdout: "ignore",
        stderr: "ignore",
      });
      expect(await child.exited).toBe(0);
      expect((await Bun.file(evidence).json()).executedCases).toBe(1);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
