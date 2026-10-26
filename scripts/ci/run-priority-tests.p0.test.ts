import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCiRuntime } from "./copy-ci-runtime.test-fixture";

test("prebuilt priority runs preserve the selected binary and collect plain Bun owner evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "priority-prebuilt-"));
  try {
    const scripts = join(root, "scripts/ci");
    const owner = join(root, "packages/fixture");
    await copyCiRuntime(root);
    await mkdir(join(owner, "src"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    await writeFile(join(owner, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "bun test" } }));
    const binary = join(root, "selected artifact", process.platform === "win32" ? "pstdio.exe" : "pstdio");
    const evidence = join(root, "test-results/ci/plain-owner/cases.json");
    await writeFile(
      join(owner, "src/environment.p0.test.ts"),
      `import {expect,test} from "bun:test";
       test("selected artifact reaches the test process", () => expect(process.env.E2E_PACKAGED_BINARY_PATH).toBe(${JSON.stringify(binary)}));`,
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
    const child = Bun.spawn([process.execPath, join(scripts, "run-priority-tests.ts"), "p0", "--prebuilt"], {
      cwd: root,
      env: {
        ...process.env,
        E2E_PACKAGED_BINARY_PATH: binary,
        BUN_TEST_EVIDENCE_FILE: evidence,
        CI_SOURCE_COVERAGE: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, output: stdout + stderr }).toMatchObject({ code: 0 });
    const result = await Bun.file(join(root, "test-results/ci/p0-results.json")).json();
    expect(result.results).toEqual([{ id: "fixture:bun", outcome: "success", exitCode: 0 }]);
    const cases = await Bun.file(evidence).json();
    expect(cases).toMatchObject({
      sourceSha: result.sourceSha,
      complete: true,
      reportedFiles: ["packages/fixture/src/environment.p0.test.ts"],
      executedCases: 1,
      coverage: { file: null },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
