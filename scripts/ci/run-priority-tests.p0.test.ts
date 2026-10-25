import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("prebuilt priority runs preserve the binary selected by the caller", async () => {
  const root = await mkdtemp(join(tmpdir(), "priority-prebuilt-"));
  try {
    const scripts = join(root, "scripts/ci");
    const owner = join(root, "packages/fixture");
    await mkdir(scripts, { recursive: true });
    await mkdir(join(owner, "src"), { recursive: true });
    for (const file of [
      "run-priority-tests.ts",
      "priority-plan.ts",
      "run-ci-checks.ts",
      "p1-fail-fast.ts",
      "test-policy.ts",
      "test-discovery.ts",
      "workspace-packages.ts",
    ])
      await cp(join(import.meta.dir, file), join(scripts, file));
    await writeFile(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    await writeFile(join(owner, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "bun test" } }));
    const binary = join(root, "selected artifact", process.platform === "win32" ? "pstdio.exe" : "pstdio");
    await writeFile(
      join(owner, "src/environment.p0.test.ts"),
      `import {expect,test} from "bun:test";
       test("selected artifact reaches the test process", () => expect(process.env.E2E_PACKAGED_BINARY_PATH).toBe(${JSON.stringify(binary)}));`,
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    const child = Bun.spawn([process.execPath, join(scripts, "run-priority-tests.ts"), "p0", "--prebuilt"], {
      cwd: root,
      env: { ...process.env, E2E_PACKAGED_BINARY_PATH: binary },
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
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
