import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCiRuntime } from "../ci/copy-ci-runtime.test-fixture";
import { runPackagedRuntimeTests } from "./packaged-runtime-tests";

test("planned runtime shards execute the complete native workload exactly once", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-shards-"));
  const cwd = join(root, "packages/e2e");
  const executed = join(root, "test-results/executed");
  const binaryPath = join(cwd, "native-candidate");
  try {
    await copyCiRuntime(root);
    mkdirSync(join(cwd, "src/packaged"), { recursive: true });
    mkdirSync(join(root, "test-results"));
    writeFileSync(join(root, ".gitignore"), "test-results/\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["packages/*"] }));
    writeFileSync(
      join(root, "scripts/ci/test-fixture-profiles.ts"),
      "export const uiFixtureExtensions=[];export const fixtureExtensionsForRunner=()=>[];\n",
    );
    // A process fixture replaces only the native lifecycle. Selection, sharding,
    // invocation and evidence still execute through the real planner and wrapper.
    writeFileSync(
      join(cwd, "src/packaged/run-packaged-cli-tests.ts"),
      `const child=Bun.spawn([process.execPath,${JSON.stringify(join(root, "scripts/ci/run-bun-tests.ts"))},...process.argv.slice(2)],{stdin:"inherit",stdout:"inherit",stderr:"inherit"});process.exitCode=await child.exited;`,
    );
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "e2e" }));
    for (let index = 0; index < 6; index++)
      writeFileSync(
        join(cwd, "src/packaged", `case-${index}.p1.test.ts`),
        `import { test, expect } from "bun:test";
import { appendFileSync } from "node:fs";
test("native case ${index}", () => {
  expect(process.env.E2E_PACKAGED_BINARY_PATH).toBe(${JSON.stringify(binaryPath)});
  appendFileSync(${JSON.stringify(executed)}, ${JSON.stringify(`${index}\n`)});
});`,
      );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"],
      { cwd: root },
    );
    const cases = () => readFileSync(executed, "utf8").trim().split("\n").sort();
    runPackagedRuntimeTests({ cwd, binaryPath });
    const complete = cases();
    expect(complete).toHaveLength(6);
    writeFileSync(executed, "");
    runPackagedRuntimeTests({ cwd, binaryPath, shard: "1/2" });
    const first = cases();
    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(complete.length);
    runPackagedRuntimeTests({ cwd, binaryPath, shard: "2/2" });
    expect(cases()).toEqual(complete);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
