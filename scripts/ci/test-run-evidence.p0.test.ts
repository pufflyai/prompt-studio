import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    expect(collectResultBundles(plan, root, "attempt")[0]?.complete).toBe(false);
    write(join(root, run.id), "cases.json", {
      planDigest: plan.digest,
      runId: run.id,
      executionId: "attempt",
      sourceSha: source.sha,
      complete: true,
      reportedFiles: [file],
      cases: [{ file, title: "retained", outcome: "success" }],
    });
    expect(collectResultBundles(plan, root, "attempt")[0]?.complete).toBe(true);
    write(root, "execution.json", {
      planDigest: plan.digest,
      executionId: "attempt",
      complete: false,
      results: [result],
      phases: [{ kind: "cleanup", complete: true, outcome: "failure" }],
    });
    expect(() => collectResultBundles(plan, root, "attempt")).toThrow("cleanup");
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
