import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCiRuntime } from "./copy-ci-runtime.test-fixture";
import { executePlan } from "./run-test-plan";
import { createTestPlan } from "./test-plan";
import { testPlanSource } from "./test-plan-source";

for (const independentFiles of [false, true])
  test(`a saved plan preserves ${independentFiles ? "independent-file continuation" : "P1 stopping"} and case evidence`, async () => {
    const root = await mkdtemp(join(tmpdir(), "planned-execution-"));
    try {
      await copyCiRuntime(root);
      await writeFile(join(root, ".gitignore"), "test-results/\n");
      const packages = ["a", "b"].map((name) => ({ name, dir: `packages/${name}`, dependencies: [], scripts: {} }));
      const files = packages.map((pkg) => `${pkg.dir}/value.p1.test.ts`);
      for (const [index, file] of files.entries()) {
        await mkdir(join(root, packages[index]!.dir), { recursive: true });
        await writeFile(
          join(root, file),
          `import {test,expect} from 'bun:test';test('real assertion',()=>expect(${index}).toBe(1));`,
        );
      }
      execFileSync("git", ["init", "--quiet"], { cwd: root });
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync(
        "git",
        ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"],
        { cwd: root },
      );
      const plan = createTestPlan({
        source: testPlanSource(root),
        target: { platform: process.platform, arch: process.arch },
        packages,
        files,
        independentFiles,
      });
      const result = await executePlan(plan, { root, prebuilt: true, env: { CI_PROFILE: "pull_request" } });
      expect(result.outcome).toBe("failure");
      expect(result.results[0]).toMatchObject({ outcome: "failure", complete: false });
      expect(result.results[1]).toMatchObject(
        independentFiles ? { outcome: "success", complete: true } : { outcome: "cancelled", complete: false },
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

test("interrupted preparation leaves no reusable input and does not start its consumer", async () => {
  const root = await mkdtemp(join(tmpdir(), "planned-interruption-"));
  try {
    await copyCiRuntime(root);
    await writeFile(join(root, ".gitignore"), "test-results/\n");
    await mkdir(join(root, "packages/e2e/src/scripts"), { recursive: true });
    const marker = join(root, "test-results/preparing.json");
    await writeFile(
      join(root, "packages/e2e/src/scripts/prepare-ui-fixtures.ts"),
      `import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';const out=process.argv[process.argv.indexOf('--out')+1]!;mkdirSync(out,{recursive:true});writeFileSync(join(out,'partial'),'unfinished');writeFileSync(${JSON.stringify(marker)},JSON.stringify({out}));await Bun.sleep(10000);throw new Error('preparation was not interrupted');`,
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "fixture"],
      { cwd: root },
    );
    const plan = createTestPlan({
      source: testPlanSource(root),
      target: { platform: process.platform, arch: process.arch },
      packages: [{ name: "e2e", dir: "packages/e2e", dependencies: [], scripts: {} }],
      files: ["packages/e2e/src/ui/consumer.p1.spec.ts"],
    });
    const controller = new AbortController();
    const execution = executePlan(plan, { root, prebuilt: true, signal: controller.signal });
    const deadline = Date.now() + 4000;
    while (!(await Bun.file(marker).exists()) && Date.now() < deadline) await Bun.sleep(10);
    const prepared = await Bun.file(marker).json();
    controller.abort("interrupted preparation");
    const result = await execution;
    expect(result.outcome).toBe("failure");
    expect(result.results[0]).toMatchObject({ outcome: "not-run", complete: false, reason: "Prerequisite failed" });
    expect(result.phases.find((phase) => phase.kind === "extension-fixtures")).toMatchObject({
      outcome: "cancelled",
      complete: false,
    });
    expect(result.phases.find((phase) => phase.kind === "cleanup")).toMatchObject({
      outcome: "success",
      complete: true,
    });
    expect(await Bun.file(join(prepared.out, "partial")).exists()).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
