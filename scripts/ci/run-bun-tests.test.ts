import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const registeredFixture = async (source?: string) => {
  const root = await mkdtemp(join(tmpdir(), "registered-empty-"));
  const scripts = join(root, "scripts/ci");
  const cwd = join(root, "packages/fixture");
  await mkdir(scripts, { recursive: true });
  await mkdir(cwd, { recursive: true });
  for (const name of ["run-bun-tests.ts", "bun-test-evidence.ts", "test-quarantine.ts", "test-policy.ts"])
    await cp(join(import.meta.dir, name), join(scripts, name));
  await writeFile(
    join(scripts, "test-quarantine.json"),
    JSON.stringify([
      {
        runner: "bun",
        file: "packages/fixture/registered.test.ts",
        name: "registered case",
        platforms: [process.platform],
        arch: process.arch,
      },
    ]),
  );
  const marker = join(root, "executed");
  await writeFile(
    join(cwd, "registered.test.ts"),
    source ??
      `import {test} from "bun:test"; test("registered case", async () => { await Bun.write(${JSON.stringify(marker)}, "ran"); });`,
  );
  const git = spawnSync("git", ["init", "--quiet"], { cwd: root });
  if (git.status !== 0) throw new Error("Could not initialize runner fixture");
  spawnSync(
    "git",
    ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--allow-empty", "-m", "fixture"],
    { cwd: root },
  );
  const evidence = join(root, "evidence.json");
  const run = async (args: string[], quarantine = false) => {
    const child = Bun.spawn([process.execPath, join(scripts, "run-bun-tests.ts"), ...args], {
      cwd,
      env: {
        ...process.env,
        CI_PRIORITY: "P2",
        E2E_TEST_LANE: quarantine ? "quarantine" : "stable",
        BUN_TEST_EVIDENCE_FILE: evidence,
      },
      stdout: "ignore",
      stderr: "ignore",
    });
    return { code: await child.exited, evidence: await Bun.file(evidence).json() };
  };
  return { root, cwd, marker, run };
};

test("an explicit registered-only scope reports unselected without inventing executed cases", async () => {
  const fixture = await registeredFixture();
  try {
    const result = await fixture.run(["./registered.test.ts", "--pass-with-no-tests"]);
    expect(result.code).toBe(0);
    expect(result.evidence).toMatchObject({ outcome: "unselected", complete: true, executedCases: 0 });
    expect(result.evidence.cases).toHaveLength(1);
    expect(result.evidence.cases[0].outcome).toBe("skipped");
    expect(result.evidence.unselectedReason).toContain("registered platform quarantine");
    expect(await Bun.file(fixture.marker).exists()).toBe(false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("allow-empty cannot certify an accidentally emptied registered file or an unregistered empty suite", async () => {
  const fixture = await registeredFixture("export {};\n");
  try {
    await writeFile(join(fixture.cwd, "empty.test.ts"), "export {};\n");
    for (const file of ["./registered.test.ts", "./empty.test.ts"]) {
      const result = await fixture.run([file, "--pass-with-no-tests"]);
      expect(result.code).not.toBe(0);
      expect(result.evidence.complete).toBe(false);
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("only explicit allow-empty is marked unselected and quarantine still executes its case", async () => {
  const fixture = await registeredFixture();
  try {
    expect((await fixture.run(["./registered.test.ts"])).evidence.outcome).toBeUndefined();
    const result = await fixture.run([], true);
    expect(result.code).toBe(0);
    expect(result.evidence.executedCases).toBe(1);
    expect(await Bun.file(fixture.marker).exists()).toBe(true);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

for (const priority of ["P0", "P1", "P2", "P3"]) {
  test(`the real Bun runner ${priority === "P1" ? "stops" : "collects"} after a ${priority} case fails`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "bun-priority-"));
    try {
      const marker = join(directory, "last-ran");
      const evidencePath = join(directory, "evidence.json");
      await writeFile(
        join(directory, "contract.test.ts"),
        `import {test,expect} from "bun:test";
        test("first fails", () => expect(true).toBe(false));
        test.skip("intentional skip", () => {});
        test("last fails too", async () => { await Bun.write(${JSON.stringify(marker)}, "ran"); expect(true).toBe(false); });`,
      );
      const child = Bun.spawn(
        [process.execPath, resolve(import.meta.dirname, "run-bun-tests.ts"), "./contract.test.ts"],
        {
          cwd: directory,
          env: { ...process.env, CI_PRIORITY: priority, BUN_TEST_EVIDENCE_FILE: evidencePath },
          stdout: "ignore",
          stderr: "ignore",
        },
      );
      expect(await child.exited).not.toBe(0);
      expect(await Bun.file(marker).exists()).toBe(priority !== "P1");
      const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
      expect(evidence.priority).toBe(priority);
      expect(evidence.cases.filter((entry: { outcome: string }) => entry.outcome === "failure")).toHaveLength(
        priority === "P1" ? 1 : 2,
      );
      expect(evidence.cases.filter((entry: { outcome: string }) => entry.outcome === "skipped")).toHaveLength(
        priority === "P1" ? 0 : 1,
      );
      expect(evidence.complete).toBe(priority !== "P1");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("a child that exits without a JUnit report cannot report successful execution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bun-missing-report-"));
  try {
    const evidencePath = join(directory, "evidence.json");
    await writeFile(join(directory, "never.test.ts"), "process.exit(0);\n");
    const child = Bun.spawn([process.execPath, resolve(import.meta.dirname, "run-bun-tests.ts"), "./never.test.ts"], {
      cwd: directory,
      env: { ...process.env, CI_PRIORITY: "P2", BUN_TEST_EVIDENCE_FILE: evidencePath },
      stdout: "ignore",
      stderr: "ignore",
    });
    expect(await child.exited).not.toBe(0);
    const evidence = await Bun.file(evidencePath).json();
    expect(evidence.complete).toBe(false);
    expect(evidence.executedCases).toBe(0);
    expect(evidence.unreportedSelectedCases).toBeNull();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
