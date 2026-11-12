import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestPlan } from "./test-plan";
import { matchesPlatform, quarantineRegistry } from "./test-quarantine";
import { collectRunEvidence } from "./test-run-evidence";
import { collectResultBundles, reconcileTestResults } from "./verify-test-results";

const source = { sha: "candidate", tree: "tree", policy: "policy", dirty: false };
const packages = [
  { name: "e2e", dir: "packages/e2e", dependencies: [], scripts: {} },
  { name: "pstdio-scripts", dir: "scripts", dependencies: [], scripts: {} },
];
const makePlan = (file: string, lane: "stable" | "quarantine") =>
  createTestPlan({ source, target: { platform: "linux", arch: "x64" }, packages, files: [file], lane });
const write = (directory: string, name: string, value: unknown) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, name), JSON.stringify(value));
};

test("registered empty stable browser selection differs from missing evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "test-evidence-"));
  try {
    const plan = makePlan("packages/e2e/src/packaged/packaged-public-text-native-sync.p2.spec.ts", "stable");
    const run = plan.runs[0]!;
    write(root, "browser.json", {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      complete: true,
      shard: "1/1",
      selected: [],
      cases: [],
      errors: [],
    });
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(true);
    expect(collectRunEvidence(root, join(root, "missing"), run, plan, "attempt").complete).toBe(false);
    const ordinary = makePlan("packages/e2e/src/ui/ordinary.p1.spec.ts", "stable");
    write(root, "browser.json", {
      planDigest: ordinary.digest,
      runId: ordinary.runs[0]!.id,
      executionId: "attempt",
      complete: true,
      shard: "1/1",
      selected: [],
      cases: [],
      errors: [],
    });
    expect(collectRunEvidence(root, root, ordinary.runs[0]!, ordinary, "attempt").complete).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("registered quarantine failures stay visible and require every named case", () => {
  const root = mkdtempSync(join(tmpdir(), "test-evidence-"));
  try {
    const file = "scripts/release/version-patch.p0.test.ts";
    const plan = makePlan(file, "quarantine");
    const run = plan.runs[0]!;
    const cases = quarantineRegistry
      .filter(
        (entry) =>
          entry.runner === "bun" &&
          matchesPlatform(entry, run.target.platform, run.target.arch) &&
          run.quarantineIds.includes(`${entry.file}:${entry.name}`),
      )
      .map((entry) => ({ file: entry.file, title: entry.name, outcome: "failure" }));
    const native = {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      sourceSha: source.sha,
      complete: true,
      reportedFiles: [file],
      cases,
    };
    write(root, "cases.json", native);
    const evidence = collectRunEvidence(root, root, run, plan, "attempt");
    expect(evidence).toMatchObject({ complete: true, quarantine: { executed: cases.length, failures: cases.length } });
    const result = {
      ...evidence,
      runId: run.id,
      planDigest: plan.digest,
      executionId: "attempt",
      source,
      outcome: "quarantined-failure" as const,
      exitCode: 1,
    };
    expect(reconcileTestResults(plan, [result], "attempt").outcome).toBe("success");
    write(root, "cases.json", { ...native, cases: cases.slice(1) });
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
    write(root, "cases.json", { ...native, cases: cases.map((entry) => ({ ...entry, outcome: "skipped" })) });
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("relocated bundles must contain matching native reports", () => {
  const root = mkdtempSync(join(tmpdir(), "test-bundle-"));
  try {
    const file = "scripts/fixture.p0.test.ts";
    const plan = makePlan(file, "stable");
    const run = plan.runs[0]!;
    const result = {
      runId: run.id,
      planDigest: plan.digest,
      source,
      executionId: "attempt",
      outcome: "success",
      complete: true,
      exitCode: 0,
      reports: [`original-checkout/${run.id}/cases.json`],
    };
    write(root, "execution.json", {
      planDigest: plan.digest,
      executionId: "attempt",
      complete: true,
      results: [result],
    });
    expect(collectResultBundles(plan, root, "attempt").records[0]?.complete).toBe(false);
    write(join(root, run.id), "cases.json", {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      sourceSha: source.sha,
      complete: true,
      reportedFiles: [file],
      cases: [{ file, title: "retained", outcome: "success" }],
    });
    expect(collectResultBundles(plan, root, "attempt").records[0]?.complete).toBe(true);
    write(root, "execution.json", {
      planDigest: plan.digest,
      executionId: "attempt",
      complete: false,
      results: [result],
      phases: [{ kind: "cleanup", complete: true, outcome: "failure" }],
    });
    const incomplete = collectResultBundles(plan, root, "attempt");
    expect(incomplete.errors).toContain(`Incomplete invocation or cleanup: ${join(root, "execution.json")}`);
    expect(incomplete.records).toHaveLength(1);
    write(root, "execution.json", { planDigest: "stale", executionId: "attempt", complete: true, results: [result] });
    const stale = collectResultBundles(plan, root, "attempt");
    expect(stale.errors[0]).toContain("Stale result bundle");
    expect(stale.records).toHaveLength(0);
    writeFileSync(join(root, "execution.json"), "unfinished {");
    const malformed = collectResultBundles(plan, root, "attempt");
    expect(malformed.errors[0]).toContain("Invalid result bundle");
    expect(malformed.records).toHaveLength(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("quarantine evidence selects one host record when case IDs repeat across hosts", () => {
  const root = mkdtempSync(join(tmpdir(), "quarantine-host-"));
  try {
    const file = "extensions/pstdio-planner/src/commands/dependency-stacks.p0.test.ts";
    const plan = createTestPlan({
      source,
      target: { platform: "darwin", arch: "arm64" },
      packages: [{ name: "pstdio-planner", dir: "extensions/pstdio-planner", dependencies: [], scripts: {} }],
      files: [file],
      lane: "quarantine",
    });
    const run = plan.runs[0]!;
    const expected = quarantineRegistry.filter(
      (entry) => entry.runner === "bun" && matchesPlatform(entry, "darwin", "arm64") && entry.file === file,
    );
    write(root, "cases.json", {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      sourceSha: source.sha,
      complete: true,
      reportedFiles: [file],
      cases: expected.map((entry) => ({ file, title: entry.name, outcome: "success" })),
    });
    expect(collectRunEvidence(root, root, run, plan, "attempt")).toMatchObject({
      complete: true,
      quarantine: { executed: 1, failures: 0 },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("benchmark bundles require their source-bound native measurements after transport", () => {
  const root = mkdtempSync(join(tmpdir(), "benchmark-evidence-"));
  try {
    const plan = createTestPlan({
      source,
      target: { platform: "linux", arch: "x64" },
      packages,
      files: ["packages/pstdio-db/src/services/sessions/session-query.p3.bench.ts"],
    });
    const run = plan.runs[0]!;
    write(root, "lifecycle.json", {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      files: run.files,
      complete: true,
    });
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
    const report = {
      format: 1,
      commit: { sha: source.sha },
      platform: "linux-x64",
      suites: [{ id: "storage" }],
      metrics: [{ suite: "storage", metric: "read", values: [10] }],
    };
    write(join(root, "performance"), `${source.sha}-linux-x64.json`, report);
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(true);
    for (const invalid of [
      { ...report, commit: { sha: "stale" } },
      { ...report, platform: "darwin-arm64" },
      { ...report, suites: [{ id: "runtime" }] },
      { ...report, metrics: [] },
    ]) {
      write(join(root, "performance"), `${source.sha}-linux-x64.json`, invalid);
      expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fixed release performance retains native logs and measurements bound to the signed source", async () => {
  const { createProductionPerformancePlan } = await import("./production-performance-plan");
  const { performanceChecks } = await import("./production-performance-profile");
  const root = mkdtempSync(join(tmpdir(), "production-performance-"));
  try {
    const plan = createProductionPerformancePlan(
      "storage",
      source,
      { platform: "linux", arch: "x64" },
      "release-source",
    );
    const run = plan.runs[0]!;
    const identity = { planDigest: plan.digest, runId: run.id, executionId: "attempt" };
    const native = join(root, "production-performance");
    const checks = performanceChecks("storage");
    write(native, "metadata.json", {
      ...identity,
      sourceSha: "release-source",
      versionSha: source.sha,
      platform: "linux",
      arch: "x64",
      checks,
    });
    write(native, "results.json", {
      ...identity,
      complete: true,
      outcome: "success",
      results: [{ id: "storage", exitCode: 0, outcome: "success" }],
    });
    mkdirSync(join(native, "logs"));
    writeFileSync(join(native, "logs/0-storage.log"), `${JSON.stringify(checks[0])}\nNative measurement completed\n`);
    writeFileSync(join(native, "storage.jsonl"), JSON.stringify({ metric: "read", value: 10 }));
    expect(collectRunEvidence(root, root, run, plan, "attempt")).toMatchObject({
      complete: true,
      nativeFailure: false,
    });
    write(native, "results.json", {
      ...identity,
      complete: true,
      outcome: "failure",
      results: [{ id: "storage", exitCode: 1, outcome: "failure" }],
    });
    expect(collectRunEvidence(root, root, run, plan, "attempt")).toMatchObject({ complete: true, nativeFailure: true });
    rmSync(join(native, "storage.jsonl"));
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("signed desktop evidence requires terminal cases from every selected benchmark file", async () => {
  const { createProductionPerformancePlan } = await import("./production-performance-plan");
  const { performanceChecks } = await import("./production-performance-profile");
  const root = mkdtempSync(join(tmpdir(), "desktop-performance-"));
  try {
    const plan = createProductionPerformancePlan("desktop", source, { platform: "darwin", arch: "arm64" });
    const run = plan.runs[0]!;
    const identity = { planDigest: plan.digest, runId: run.id, executionId: "attempt" };
    const native = join(root, "production-performance");
    const checks = performanceChecks("desktop");
    write(native, "metadata.json", {
      ...identity,
      sourceSha: source.sha,
      versionSha: source.sha,
      platform: "darwin",
      arch: "arm64",
      checks,
    });
    write(native, "results.json", {
      ...identity,
      complete: true,
      outcome: "success",
      results: [{ id: "desktop", exitCode: 0, outcome: "success" }],
    });
    mkdirSync(join(native, "logs"));
    writeFileSync(join(native, "logs/0-desktop.log"), `${JSON.stringify(checks[0])}\n`);
    const report = {
      ...identity,
      complete: true,
      selected: ["first"],
      cases: [{ id: "first", file: run.files[0], outcome: "passed" }],
      errors: [],
    };
    const ordered = {
      config: { rootDir: "clients/desktop", metadata: { quarantineAttempt: "native" } },
      suites: [
        {
          specs: run.files.map((file, index) => ({
            file: file.replace("clients/desktop/", ""),
            title: String(index),
            tests: [{ results: [{ status: "passed" }] }],
          })),
        },
      ],
      errors: [],
    };
    write(native, "desktop-ordered.json", ordered);
    write(native, "desktop-attempt.json", {
      ...identity,
      sourceSha: source.sha,
      platform: "darwin",
      arch: "arm64",
      token: "native",
    });
    write(native, "desktop-cases.json", report);
    expect(collectRunEvidence(root, root, run, plan, "attempt").complete).toBe(false);
    write(native, "desktop-cases.json", {
      ...report,
      selected: ["first", "second"],
      cases: [...report.cases, { id: "second", file: run.files[1], outcome: "passed" }],
    });
    expect(collectRunEvidence(root, root, run, plan, "attempt")).toMatchObject({
      complete: true,
      reportedFiles: [...run.files].sort(),
    });
    ordered.suites[0]!.specs[1]!.tests[0]!.results[0]!.status = "failed";
    write(native, "desktop-ordered.json", ordered);
    expect(collectRunEvidence(root, root, run, plan, "attempt")).toMatchObject({ complete: true, nativeFailure: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// An interrupted host must leave an inspectable failure report without discarding completed sibling hosts.
test("CI verification retains cancelled, failed, missing and completed assignments after interruption", async () => {
  const root = mkdtempSync(join(tmpdir(), "interrupted-plan-verification-"));
  try {
    const owners = ["cancelled", "completed", "failed", "missing"].map((name) => ({
      name,
      dir: `packages/${name}`,
      dependencies: [],
      scripts: {},
    }));
    const plan = createTestPlan({
      source,
      target: { platform: "linux", arch: "x64" },
      packages: owners,
      files: owners.map((owner) => `${owner.dir}/behavior.p0.test.ts`),
    });
    write(root, "plan.json", plan);
    for (const owner of owners.slice(0, 3)) {
      const run = plan.runs.find((run) => run.owner === owner.name)!;
      const directory = join(root, "bundles", owner.name);
      const cancelled = owner.name === "cancelled";
      const failed = owner.name === "failed";
      let outcome = "success";
      let exitCode: number | null = 0;
      if (cancelled) {
        outcome = "cancelled";
        exitCode = null;
      } else if (failed) {
        outcome = "failure";
        exitCode = 1;
      }
      write(directory, "execution.json", {
        planDigest: plan.digest,
        executionId: "attempt",
        complete: !cancelled,
        results: [
          {
            runId: run.id,
            planDigest: plan.digest,
            source,
            executionId: "attempt",
            outcome,
            complete: !cancelled,
            exitCode,
            reports: [],
            ...(cancelled ? { reason: "Host interrupted" } : {}),
          },
        ],
      });
      if (!cancelled)
        write(join(directory, run.id), "cases.json", {
          planDigest: plan.digest,
          runId: run.id,
          executionId: "attempt",
          sourceSha: source.sha,
          complete: true,
          reportedFiles: run.files,
          cases: [{ file: run.files[0], title: "retained contract", outcome: failed ? "failure" : "success" }],
        });
    }
    const completed = plan.runs.find((run) => run.owner === "completed")!;
    for (const [name, invalid] of Object.entries({
      "missing-source": { source: undefined, complete: true },
      "invalid-completeness": { source, complete: "false" },
    })) {
      const directory = join(root, "bundles", name);
      write(directory, "execution.json", {
        planDigest: plan.digest,
        executionId: "attempt",
        complete: true,
        results: [
          {
            runId: completed.id,
            planDigest: plan.digest,
            executionId: "attempt",
            outcome: "success",
            exitCode: 0,
            reports: [],
            ...invalid,
          },
        ],
      });
      write(join(directory, completed.id), "cases.json", {
        planDigest: plan.digest,
        runId: completed.id,
        executionId: "attempt",
        sourceSha: source.sha,
        complete: true,
        reportedFiles: completed.files,
        cases: [{ file: completed.files[0], title: "retained contract", outcome: "success" }],
      });
    }
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "verify-test-results.ts"),
        join(root, "plan.json"),
        join(root, "bundles"),
      ],
      {
        cwd: root,
        env: { ...process.env, CI_TEST_EXECUTION_ID: "attempt" },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, output] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(exitCode).toBe(1);
    const report = join(root, "test-results/ci/plan-verification.json");
    expect(existsSync(report), output).toBe(true);
    const evidence = JSON.parse(readFileSync(report, "utf8"));
    expect(evidence).toMatchObject({ outcome: "failure", complete: false });
    expect(evidence.errors.filter((error: string) => error.includes("Invalid run record"))).toHaveLength(2);
    expect(evidence.results).toHaveLength(3);
    expect(evidence.errors.some((error: string) => error.includes("Incomplete invocation"))).toBe(true);
    expect(evidence.errors).toContain(`Missing run: ${plan.runs.find((run) => run.owner === "missing")!.id}`);
    expect(evidence.results.find((result: { outcome: string }) => result.outcome === "cancelled")).toMatchObject({
      complete: false,
      reason: expect.stringContaining("Host interrupted"),
    });
    expect(evidence.results.find((result: { outcome: string }) => result.outcome === "failure")).toMatchObject({
      complete: true,
      exitCode: 1,
      nativeFailure: true,
    });
    expect(evidence.results.find((result: { outcome: string }) => result.outcome === "success")).toMatchObject({
      complete: true,
      exitCode: 0,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
