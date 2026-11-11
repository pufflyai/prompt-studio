import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCiRuntime } from "./copy-ci-runtime.test-fixture";

test("source-only preview and saved execution preserve selected files, artifacts and case evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "test-command-"));
  try {
    await copyCiRuntime(root);
    await mkdir(join(root, "packages/fixture/src"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    await writeFile(join(root, ".gitignore"), "test-results/\n");
    await writeFile(
      join(root, "packages/fixture/package.json"),
      JSON.stringify({ name: "fixture", scripts: { test: "not-a-runner" } }),
    );
    const binary = join(root, "selected artifact", "pstdio");
    const file = "packages/fixture/src/environment.p0.test.ts";
    await writeFile(
      join(root, file),
      `import {test,expect} from 'bun:test';test('selected artifact',()=>expect(process.env.E2E_PACKAGED_BINARY_PATH).toBe(${JSON.stringify(binary)}));`,
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"],
      { cwd: root },
    );
    const run = async (args: string[], cwd = root) => {
      const child = Bun.spawn([process.execPath, join(root, "scripts/test.ts"), ...args], {
        cwd,
        env: { ...process.env, E2E_PACKAGED_BINARY_PATH: binary, CI_SOURCE_COVERAGE: "1" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, output: stderr }).toMatchObject({ code: 0 });
      return stdout;
    };
    const plan = JSON.parse(
      await run(["--file", file, "--priority", "p0", "--list", "--out", "test-results/ci/plan.json"]),
    );
    expect(plan.runs.flatMap((entry: { files: string[] }) => entry.files)).toEqual([file]);
    const scoped = JSON.parse(
      await run(["src/environment.p0.test.ts", "--scope=fixture", "--list"], join(root, "packages/fixture")),
    );
    expect(scoped.runs.flatMap((entry: { files: string[] }) => entry.files)).toEqual([file]);
    const slower = "packages/fixture/src/z-slow.p0.test.ts";
    await writeFile(join(root, slower), "import {test} from 'bun:test';test('slow',()=>{});");
    const snapshot = {
      version: 1,
      capturedAt: "2026-11-11T00:00:00Z",
      observations: [
        {
          kind: "file",
          key: slower,
          profile: "fixture/bun",
          host: `${process.platform}/${process.arch}`,
          configuration: "source:stable:P0",
          coverage: true,
          durationMs: 100,
          samples: 3,
          observedAt: "2026-11-10T00:00:00Z",
          sourceSha: "baseline",
          provenance: "qualification",
        },
        {
          kind: "file",
          key: file,
          profile: "fixture/bun",
          host: `${process.platform}/${process.arch}`,
          configuration: "source:stable:P0",
          coverage: true,
          durationMs: 1,
          samples: 3,
          observedAt: "2026-11-10T00:00:00Z",
          sourceSha: "baseline",
          provenance: "qualification",
        },
      ],
    };
    await writeFile(join(root, "test-results/timings.json"), JSON.stringify(snapshot));
    const timed = JSON.parse(
      await run(
        ["src", "--scope=fixture", "--shard=1/2", "--timings", join(root, "test-results/timings.json"), "--list"],
        join(root, "packages/fixture"),
      ),
    );
    expect(timed.runs.flatMap((entry: { files: string[] }) => entry.files)).toEqual([slower]);
    expect(timed.timingSnapshot).toEqual(snapshot);
    await rm(join(root, slower));
    const benchmarks = ["packages/fixture/src/first.p3.test.ts", "packages/fixture/src/second.p3.test.ts"];
    for (const benchmark of benchmarks)
      await writeFile(join(root, benchmark), "import {test} from 'bun:test';test('full workload',()=>{});");
    const p3 = JSON.parse(await run([...benchmarks, "--list"]));
    expect(p3.runs.flatMap((entry: { files: string[] }) => entry.files)).toEqual(benchmarks);
    expect(p3.runs.every((entry: { priority: string }) => entry.priority === "P3")).toBe(true);
    for (const benchmark of benchmarks) await rm(join(root, benchmark));

    await writeFile(
      join(root, "packages/fixture/src/unselected.p0.test.ts"),
      "throw new Error('unselected test executed');",
    );
    // A changed checkout cannot execute the saved plan, even if its tests are still present.
    const stale = Bun.spawn(
      [process.execPath, "scripts/test.ts", "--plan", "test-results/ci/plan.json", "--prebuilt"],
      { cwd: root, stdout: "pipe", stderr: "pipe" },
    );
    const staleText = await new Response(stale.stderr).text();
    expect(await stale.exited).toBe(1);
    expect(staleText).toContain("source does not match");
    await rm(join(root, "packages/fixture/src/unselected.p0.test.ts"));
    await run(["--plan", "test-results/ci/plan.json", "--prebuilt"]);
    const reports = [
      ...new Bun.Glob("**/execution.json").scanSync({ cwd: join(root, "test-results/ci/planned"), absolute: true }),
    ];
    expect(reports).toHaveLength(1);
    const result = await Bun.file(reports[0]!).json();
    expect(result).toMatchObject({ outcome: "success", complete: true });
    expect(result.results[0].reports).toHaveLength(1);
    const cases = await Bun.file(join(root, result.results[0].reports[0])).json();
    expect(cases).toMatchObject({ complete: true, reportedFiles: [file], executedCases: 1, coverage: { file: null } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
