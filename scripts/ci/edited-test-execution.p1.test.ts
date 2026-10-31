import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyCiRuntime } from "./copy-ci-runtime.test-fixture";

test("edited desktop benchmarks delegate once to the ordered adapter without repeating its quarantine", async () => {
  const root = await mkdtemp(join(tmpdir(), "edited-desktop-benchmark-"));
  try {
    await copyCiRuntime(root);
    await mkdir(join(root, "packages/benchmarks/src"), { recursive: true });
    await writeFile(
      join(root, "packages/benchmarks/src/cli.ts"),
      `import {appendFileSync} from "node:fs";appendFileSync("benchmark-calls.jsonl",JSON.stringify(process.argv.slice(2))+"\\n");`,
    );
    await writeFile(
      join(root, "scripts/ci/run-quarantined-tests.ts"),
      `await Bun.write("repeated.txt","repeated quarantine");process.exit(1);`,
    );
    const file = "clients/desktop/src/e2e/example.p3.bench.ts";
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), "export {};");
    await writeFile(
      join(root, "scripts/ci/test-quarantine.json"),
      JSON.stringify([
        { runner: "packaged-desktop-benchmark", file, name: "registered case", platforms: [process.platform] },
      ]),
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: root },
    );
    const child = Bun.spawn([process.execPath, join(root, "scripts/ci/run-edited-tests.ts")], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        EDITED_TEST_ROW: JSON.stringify({
          name: "desktop",
          suite: "desktop",
          priority: "P3",
          files: JSON.stringify([file]),
          quarantine: true,
        }),
        GITHUB_STEP_SUMMARY: "",
      },
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
    const calls = (await Bun.file(join(root, "benchmark-calls.jsonl")).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(expect.arrayContaining(["--suites", "desktop", "--samples", "1"]));
    expect(
      await access(join(root, "repeated.txt")).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a selected higher-priority test executes without running an unrelated failing test", async () => {
  const root = await mkdtemp(join(tmpdir(), "edited-test-execution-"));
  try {
    await copyCiRuntime(root);
    const owner = join(root, "packages/fixture");
    await mkdir(join(owner, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    await writeFile(
      join(owner, "package.json"),
      JSON.stringify({ name: "fixture", scripts: { test: "bun test ./src" } }),
    );
    const selected = "packages/fixture/src/selected.p2.test.ts";
    await writeFile(
      join(root, selected),
      `import {test,expect} from "bun:test";test("selected behavior",()=>expect(2+2).toBe(4));`,
    );
    await writeFile(
      join(owner, "src/unrelated.p2.test.ts"),
      `import {test,expect} from "bun:test";test("unrelated failure",()=>expect(true).toBe(false));`,
    );
    const selection = join(root, "selected.json");
    await writeFile(selection, JSON.stringify([selected]));
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: root },
    );
    const child = Bun.spawn(
      [process.execPath, join(root, "scripts/ci/run-priority-tests.ts"), "p2", "--files-from", selection, "--prebuilt"],
      {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, CI_SOURCE_COVERAGE: "0" },
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
    const report = await Bun.file(join(root, "test-results/ci/p2-results.json")).json();
    expect(report.selectedFiles).toEqual([selected]);
    expect(report.results).toEqual([{ id: "fixture:bun", outcome: "success", exitCode: 0 }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("edited quarantine selection executes and verifies only the requested registered file", async () => {
  const root = await mkdtemp(join(tmpdir(), "edited-quarantine-selection-"));
  try {
    await copyCiRuntime(root);
    const typescript = import.meta.resolve("typescript");
    const typescriptFile = typescript.startsWith("file:") ? fileURLToPath(typescript) : typescript;
    await symlink(
      dirname(dirname(typescriptFile)),
      join(root, "node_modules/typescript"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const owner = join(root, "packages/fixture");
    await mkdir(join(owner, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    await writeFile(
      join(owner, "package.json"),
      JSON.stringify({ name: "fixture", scripts: { test: "bun ../../scripts/ci/run-bun-tests.ts" } }),
    );
    const file = "packages/fixture/src/selected.p2.test.ts";
    const other = "packages/fixture/src/unrelated.p2.test.ts";
    await writeFile(
      join(root, file),
      `import {test,expect} from "bun:test";test("selected registered case",()=>expect(1).toBe(1));`,
    );
    await writeFile(
      join(root, other),
      `import {test,expect} from "bun:test";test("unrelated registered case",()=>expect(true).toBe(false));`,
    );
    await writeFile(
      join(root, "scripts/ci/test-quarantine.json"),
      JSON.stringify([
        { runner: "bun", file, name: "selected registered case", platforms: [process.platform] },
        { runner: "bun", file: other, name: "unrelated registered case", platforms: [process.platform] },
      ]),
    );
    const selection = join(root, "selection.json");
    await writeFile(selection, JSON.stringify([file]));
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: root },
    );
    for (const script of ["run-quarantined-tests.ts", "verify-quarantine-reports.ts"]) {
      const child = Bun.spawn(
        [
          process.execPath,
          join(root, "scripts/ci", script),
          "bun",
          "--scope",
          "fixture",
          "--files-from",
          selection,
          "--prebuilt",
        ],
        {
          cwd: root,
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, CI_SOURCE_COVERAGE: "0" },
        },
      );
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("edited-test execution builds once, checks later files after a failure, and preserves each result", async () => {
  const root = await mkdtemp(join(tmpdir(), "edited-test-reporting-"));
  try {
    await copyCiRuntime(root);
    const owner = join(root, "packages/fixture");
    await mkdir(join(owner, "src"), { recursive: true });
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"], scripts: { build: "bun build.fixture.ts" } }),
    );
    await writeFile(join(root, "build.fixture.ts"), `await Bun.write("built.txt","ready");`);
    await writeFile(
      join(owner, "package.json"),
      JSON.stringify({ name: "fixture", scripts: { test: "bun test ./src" } }),
    );
    const files = ["packages/fixture/src/first.p1.test.ts", "packages/fixture/src/second.p1.test.ts"];
    await writeFile(
      join(root, files[0]!),
      `import {test,expect} from "bun:test";test("first edited behavior",()=>expect(true).toBe(false));`,
    );
    await writeFile(
      join(root, files[1]!),
      `import {test,expect} from "bun:test";import {readFileSync} from "node:fs";test("second edited behavior",()=>expect(readFileSync("../../built.txt","utf8")).toBe("ready"));`,
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.test",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: root },
    );
    const child = Bun.spawn([process.execPath, join(root, "scripts/ci/run-edited-tests.ts")], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        CI_SOURCE_COVERAGE: "0",
        GITHUB_STEP_SUMMARY: join(root, "summary.md"),
        EDITED_TEST_ROW: JSON.stringify({
          name: "fixture",
          owner: "fixture",
          priority: "P1",
          runner: "bun",
          files: JSON.stringify(files),
          stable: true,
          desktop: false,
          suite: "",
        }),
      },
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, output: stdout + stderr }).toMatchObject({ code: 1 });
    const report = await Bun.file(join(root, "test-results/edited-tests/results.json")).json();
    expect(report.selectedFiles).toEqual(files);
    expect(report.results.map((result: { exitCode: number }) => result.exitCode)).toEqual([1, 0]);
    expect(await Bun.file(join(root, "test-results/edited-tests/result-0.json")).exists()).toBe(true);
    expect(await Bun.file(join(root, "test-results/edited-tests/result-1.json")).exists()).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
