import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { suites } from "./benchmark-registry";
import { createTestPlan } from "./test-plan";
import { matchesPlatform, quarantineRegistry } from "./test-quarantine";
import { collectRunEvidence } from "./test-run-evidence";

const source = { sha: "candidate", tree: "tree", policy: "policy", dirty: false };
const write = (root: string, file: string, value: unknown) => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeFileSync(join(root, file), JSON.stringify(value));
};

for (const suite of ["desktop", "workbench", "subnav"]) {
  test(`${suite} source qualification reopens native failures, attempt identity and file coverage`, () => {
    const root = mkdtempSync(join(tmpdir(), "source-benchmark-evidence-"));
    try {
      const files = suites.find((entry) => entry.id === suite)!.files;
      const plan = createTestPlan({ source, packages: [], files, target: { platform: "linux", arch: "x64" } });
      const run = plan.runs[0]!;
      const identity = { planDigest: plan.digest, runId: run.id, executionId: "attempt" };
      write(root, "lifecycle.json", { ...identity, complete: true, outcome: "success", files: run.files });
      write(root, "performance/candidate-linux-x64.json", {
        format: 1,
        commit: { sha: source.sha },
        platform: "linux-x64",
        suites: [{ id: suite }],
        metrics: [{ suite, metric: "measured", values: [1] }],
      });
      const profile = { desktop: "desktop", workbench: "frontend", subnav: "sidenav-subnav" }[suite]!;
      const runner = {
        desktop: "packaged-desktop-benchmark",
        workbench: "workbench-benchmark",
        subnav: "subnav-benchmark",
      }[suite];
      const orderedFiles = files.filter((file) => !file.includes("/packaged/"));
      const expected = quarantineRegistry.filter(
        (entry) => entry.runner === runner && matchesPlatform(entry, "linux", "x64"),
      );
      const cases = expected.map((entry) => ({ file: entry.file, title: entry.name }));
      for (const file of orderedFiles)
        if (!cases.some((entry) => entry.file === file)) cases.push({ file, title: file });
      if (suite === "subnav") {
        while (cases.length < 14) cases.push({ file: files[0]!, title: `stable ${cases.length}` });
        const order = ["ticket/first", "sessions/first", "ticket/repeat", "sessions/repeat"];
        write(root, "performance/subnav/results.json", {
          sourceCommit: source.sha,
          platform: "linux/x64",
          samples: Array.from({ length: 120 }, (_, index) => {
            const [destination, visit] = order[index % 4]!.split("/");
            return { destination, visit };
          }),
        });
      }
      cases.push({ file: orderedFiles[0]!, title: "stable contract" });
      if (suite === "subnav") cases.splice(cases.length - 2, 1);
      const report = {
        config: { rootDir: ".", metadata: { quarantineAttempt: "native" } },
        suites: [{ specs: cases.map((entry) => ({ ...entry, tests: [{ results: [{ status: "passed" }] }] })) }],
        errors: [],
      };
      const attempt = { ...identity, sourceSha: source.sha, platform: "linux", arch: "x64", token: "native" };
      write(root, `${profile}-ordered.json`, report);
      write(root, `${profile}-attempt.json`, attempt);
      if (suite === "workbench") {
        write(root, "browser.json", {
          ...identity,
          complete: true,
          selected: ["packaged"],
          errors: [],
          cases: [{ id: "packaged", file: files.at(-1), outcome: "passed" }],
        });
      }
      const evidence = () => collectRunEvidence(root, root, run, plan, "attempt");
      expect(evidence()).toMatchObject({ complete: true, nativeFailure: false, reportedFiles: run.files });
      report.suites[0]!.specs.at(-1)!.tests[0]!.results[0]!.status = "failed";
      write(root, `${profile}-ordered.json`, report);
      expect(evidence()).toMatchObject({ complete: true, nativeFailure: true });
      write(root, `${profile}-attempt.json`, { ...attempt, executionId: "stale" });
      expect(evidence().complete).toBe(false);
      write(root, `${profile}-attempt.json`, attempt);
      const omitted = orderedFiles.at(-1)!;
      report.suites[0]!.specs = report.suites[0]!.specs.filter((entry) => entry.file !== omitted);
      write(root, `${profile}-ordered.json`, report);
      expect(evidence().complete).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("planner qualification requires all three cold-open measurements", () => {
  const root = mkdtempSync(join(tmpdir(), "planner-benchmark-evidence-"));
  try {
    const plan = createTestPlan({
      source,
      packages: [],
      files: suites.find((entry) => entry.id === "planner")!.files,
      target: { platform: "linux", arch: "x64" },
    });
    const run = plan.runs[0]!;
    write(root, "lifecycle.json", {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      complete: true,
      files: run.files,
    });
    mkdirSync(join(root, "performance"));
    const measurement = JSON.stringify({ metric: "cold-open", value: 10 });
    writeFileSync(join(root, "performance/planner.jsonl"), Array(3).fill(measurement).join("\n"));
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(true);
    writeFileSync(join(root, "performance/planner.jsonl"), measurement);
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
