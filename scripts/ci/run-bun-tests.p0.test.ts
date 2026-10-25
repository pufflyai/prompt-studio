import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const registeredFixture = async (source?: string) => {
  const root = await mkdtemp(join(tmpdir(), "registered-empty-"));
  const scripts = join(root, "scripts/ci");
  const cwd = join(root, "packages/fixture");
  await mkdir(scripts, { recursive: true });
  await mkdir(cwd, { recursive: true });
  for (const name of [
    "run-bun-tests.ts",
    "bun-test-evidence.ts",
    "test-quarantine.ts",
    "quarantine-reports.ts",
    "quarantine-retries.ts",
    "test-policy.ts",
    "test-discovery.ts",
  ])
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
  await mkdir(join(root, "node_modules"), { recursive: true });
  const typescriptLocation = import.meta.resolve("typescript");
  const typescriptFile = typescriptLocation.startsWith("file:")
    ? fileURLToPath(typescriptLocation)
    : typescriptLocation;
  await symlink(
    dirname(dirname(typescriptFile)),
    join(root, "node_modules/typescript"),
    process.platform === "win32" ? "junction" : "dir",
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
    return {
      code: await child.exited,
      evidence: (await Bun.file(evidence).exists()) ? await Bun.file(evidence).json() : null,
    };
  };
  return { root, cwd, marker, run };
};

test.each([
  "fixture",
  "pstdio-api",
])("the quarantine controller preserves %s fixtures and verifies their evidence", async (owner) => {
  const webviewBuilds = owner === "pstdio-api" ? "0" : "1";
  const defaults = owner === "pstdio-api" ? "[]" : '["fixture-default"]';
  const fixture = await registeredFixture(`import { test, expect } from "bun:test";
    test("registered case", () => {
      expect(process.env.PSTDIO_EXTENSION_WEBVIEW_BUILDS).toBe(${JSON.stringify(webviewBuilds)});
      expect(process.env.PSTDIO_DEFAULT_EXTENSIONS).toBe(${JSON.stringify(defaults)});
    });`);
  try {
    for (const name of [
      "run-quarantined-tests.ts",
      "verify-quarantine-reports.ts",
      "workspace-packages.ts",
      "run-ci-checks.ts",
      "p1-fail-fast.ts",
    ])
      await cp(join(import.meta.dir, name), join(fixture.root, "scripts/ci", name));
    await writeFile(join(fixture.root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    await writeFile(
      join(fixture.cwd, "package.json"),
      JSON.stringify({ name: owner, scripts: { test: "bun ../../scripts/ci/run-bun-tests.ts" } }),
    );
    const env = {
      ...process.env,
      CI_PRIORITY: "P2",
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
      PSTDIO_DEFAULT_EXTENSIONS: '["fixture-default"]',
    };
    const run = async (script: string, args: string[]) => {
      const child = Bun.spawn([process.execPath, join(fixture.root, "scripts/ci", script), ...args], {
        cwd: fixture.root,
        env,
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(child.stdout).text();
      const errors = await new Response(child.stderr).text();
      return { code: await child.exited, output: output + errors };
    };
    expect(await run("run-quarantined-tests.ts", ["bun", "--prebuilt"])).toMatchObject({ code: 0 });
    const result = await run("verify-quarantine-reports.ts", ["bun"]);
    expect(result).toMatchObject({ code: 0 });
    expect(result.output).toContain("1 quarantined cases executed once; 0 failed");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("priority selection excludes another tier even when a package script selects its whole source directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bun-priority-selection-"));
  try {
    await writeFile(
      join(directory, "local.p0.test.ts"),
      'import {test,expect} from "bun:test"; test("local rule",()=>expect(1).toBe(1));',
    );
    await writeFile(
      join(directory, "integrated.p1.test.ts"),
      'import {test,expect} from "bun:test"; test("must not execute",()=>expect(1).toBe(2));',
    );
    const evidence = join(directory, "cases.json");
    const child = Bun.spawn([process.execPath, join(import.meta.dir, "run-bun-tests.ts"), directory], {
      cwd: directory,
      env: { ...process.env, TEST_PRIORITIES: "P0", CI_PRIORITY: "P0", BUN_TEST_EVIDENCE_FILE: evidence },
      stdout: "ignore",
      stderr: "ignore",
    });
    expect(await child.exited).toBe(0);
    const result = await Bun.file(evidence).json();
    expect(result.executedCases).toBe(1);
    expect(result.cases[0].title).toContain("local rule");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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

test("a declared Bun retry cannot certify quarantine as a first attempt", async () => {
  const f = await registeredFixture(
    'import {test} from "bun:test";let attempt=0;test("registered case",{retry:1},()=>{if(attempt++===0)throw new Error("first attempt");});',
  );
  try {
    const result = await f.run([], true);
    expect(result.code).not.toBe(0);
    expect(result.evidence).toBeNull();
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("quarantine collects registered failures and later cases without retries", async () => {
  const f = await registeredFixture(
    'import {test} from "bun:test";test("registered case",()=>{throw new Error("known failure");});test("another case",()=>{});',
  );
  try {
    const path = join(f.root, "scripts/ci/test-quarantine.json");
    const entries = await Bun.file(path).json();
    entries.push({ ...entries[0], name: "another case" });
    await Bun.write(path, JSON.stringify(entries));
    const result = await f.run([], true);
    expect(result.code).not.toBe(0);
    expect(result.evidence.complete).toBe(true);
    expect(result.evidence.executedCases).toBe(2);
    expect(result.evidence.cases.filter((c: { outcome: string }) => c.outcome === "failure")).toHaveLength(1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
