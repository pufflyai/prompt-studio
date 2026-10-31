import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyCiRuntime } from "./copy-ci-runtime.test-fixture";

for (const scenario of ["quarantined failure", "stable failure", "stale report"] as const) {
  test(`ordered workbench evidence handles ${scenario} without repeating a case`, async () => {
    const root = await mkdtemp(join(tmpdir(), "ordered-workbench-"));
    try {
      await copyCiRuntime(root);
      const cwd = join(root, "packages/e2e");
      await mkdir(join(cwd, "src/scripts"), { recursive: true });
      const name = "switches projects once and within budget";
      await writeFile(
        join(root, "scripts/ci/test-quarantine.json"),
        JSON.stringify([
          {
            runner: "workbench-benchmark",
            file: "packages/e2e/src/perf/project-switch.p3.bench.ts",
            name,
            platforms: [process.platform],
          },
        ]),
      );
      await writeFile(
        join(cwd, "src/scripts/run-playwright.ts"),
        `import {mkdirSync,appendFileSync,writeFileSync} from "node:fs";
appendFileSync("calls.jsonl",JSON.stringify(process.argv.slice(2))+"\\n");
mkdirSync("test-results",{recursive:true});
writeFileSync("test-results/workbench-benchmarks.json",JSON.stringify({
config:{rootDir:process.cwd()+"/src/perf",metadata:{quarantineAttempt:${scenario === "stale report" ? '"stale"' : "process.env.CI_QUARANTINE_ATTEMPT"}}},
suites:[{specs:[
{file:"project-switch.p3.bench.ts",title:${JSON.stringify(name)},tests:[{results:[{status:"failed"}]}]},
{file:"side-panel.p3.bench.ts",title:"stable interaction",tests:[{results:[{status:${JSON.stringify(scenario === "stable failure" ? "failed" : "passed")}}]}]}
]}]}));
process.exit(1);`,
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
      const child = Bun.spawn([process.execPath, join(root, "scripts/ci/run-workbench-benchmarks.ts")], {
        cwd: root,
        env: { ...process.env, GITHUB_STEP_SUMMARY: "" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect({ code, output: stdout + stderr }).toMatchObject({ code: scenario === "quarantined failure" ? 0 : 1 });
      expect((await Bun.file(join(cwd, "calls.jsonl")).text()).trim().split("\n")).toHaveLength(1);
      if (scenario === "stale report") {
        expect(stderr).toContain("Stale browser benchmark report");
      } else {
        const report = await Bun.file(join(cwd, "test-results/workbench-benchmarks-quarantine.json")).json();
        expect(report.suites[0].specs.map((spec: { title: string }) => spec.title)).toEqual([name]);
        expect(report.suites[0].specs[0].tests[0].results[0].status).toBe("failed");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
