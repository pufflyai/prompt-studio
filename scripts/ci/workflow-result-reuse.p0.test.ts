import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestPlan } from "./test-plan";
import { collectResultBundles, reconcileTestResults } from "./verify-test-results";

const source = { sha: "candidate", tree: "tree", policy: "policy", dirty: false };
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "workflow-results-"));
  const plan = createTestPlan({
    source,
    target: { platform: "linux", arch: "x64" },
    packages: [{ name: "scripts", dir: "scripts", dependencies: [], scripts: {} }],
    files: ["scripts/retained.p0.test.ts", "scripts/repaired.p1.test.ts"],
    lane: "stable",
  });
  const bundle = (name: string, index: number, executionId: string, success: boolean, complete = true) => {
    const run = plan.runs[index]!;
    const directory = join(root, name);
    mkdirSync(join(directory, run.id), { recursive: true });
    const write = (path: string, value: unknown) => writeFileSync(join(directory, path), JSON.stringify(value));
    write(join(run.id, "cases.json"), {
      planDigest: plan.digest,
      runId: run.id,
      executionId,
      sourceSha: source.sha,
      complete: true,
      reportedFiles: run.files,
      cases: run.files.map((file) => ({ file, title: "real assertion", outcome: success ? "success" : "failure" })),
    });
    write("execution.json", {
      planDigest: plan.digest,
      executionId,
      complete,
      runIds: [run.id],
      results: [
        {
          runId: run.id,
          planDigest: plan.digest,
          source,
          executionId,
          outcome: success ? "success" : "failure",
          complete: true,
          exitCode: success ? 0 : 1,
          reports: [],
        },
      ],
    });
  };
  const read = (executionId = "900/2") => {
    const collected = collectResultBundles(plan, root, executionId);
    return {
      ...collected,
      ...reconcileTestResults(plan, collected.records, executionId),
      bundleErrors: collected.errors,
    };
  };
  return { root, plan, bundle, read, close: () => rmSync(root, { recursive: true, force: true }) };
};

test("a failed-only rerun retains native passing evidence from the same workflow without relabeling it", () => {
  const run = fixture();
  try {
    run.bundle("retained-attempt-1", 0, "900/1", true);
    run.bundle("failed-attempt-1", 1, "900/1", false, false);
    run.bundle("repaired-attempt-2", 1, "900/2", true);
    const result = run.read();
    expect(result.bundleErrors).toEqual([]);
    expect(result.outcome).toBe("success");
    expect(result.records.map((record) => record.executionId).sort()).toEqual(["900/1", "900/2"]);
  } finally {
    run.close();
  }
});

test("a newer failure cannot be replaced by an older pass", () => {
  const run = fixture();
  try {
    run.bundle("retained", 0, "900/1", true);
    run.bundle("old-pass", 1, "900/1", true);
    run.bundle("new-failure", 1, "900/2", false);
    const result = run.read();
    expect(result.outcome).toBe("failure");
    expect(result.records.find((record) => record.runId === run.plan.runs[1]!.id)?.executionId).toBe("900/2");
  } finally {
    run.close();
  }
});

test.each(["901/1", "900/3"])("evidence from another workflow or a future attempt is rejected: %s", (executionId) => {
  const run = fixture();
  try {
    run.bundle("foreign", 0, executionId, true);
    run.bundle("current", 1, "900/2", true);
    expect(run.read().bundleErrors.length).toBeGreaterThan(0);
  } finally {
    run.close();
  }
});

test("an interrupted rerun shadows old passes even before its assigned results are written", () => {
  const run = fixture();
  try {
    run.bundle("retained", 0, "900/1", true);
    run.bundle("old-pass", 1, "900/1", true);
    run.bundle("interrupted", 1, "900/2", false, false);
    const file = join(run.root, "interrupted/execution.json");
    const pending = JSON.parse(readFileSync(file, "utf8"));
    pending.results = [];
    writeFileSync(file, JSON.stringify(pending));
    const result = run.read();
    expect(result.outcome).toBe("failure");
    expect(result.bundleErrors.some((error) => error.includes("Incomplete invocation"))).toBe(true);
    expect(result.records).toHaveLength(1);
  } finally {
    run.close();
  }
});

test("retained native receipts must still belong to their original attempt", () => {
  const run = fixture();
  try {
    run.bundle("retained", 0, "900/1", true);
    run.bundle("current", 1, "900/2", true);
    const file = join(run.root, "retained", run.plan.runs[0]!.id, "cases.json");
    const receipt = JSON.parse(readFileSync(file, "utf8"));
    receipt.executionId = "900/2";
    writeFileSync(file, JSON.stringify(receipt));
    expect(run.read().outcome).toBe("failure");
  } finally {
    run.close();
  }
});

test("duplicate newest assignments and superseded foreign source identities are rejected", () => {
  const run = fixture();
  try {
    run.bundle("retained", 0, "900/1", true);
    run.bundle("current", 1, "900/2", true);
    run.bundle("duplicate", 1, "900/2", true);
    expect(run.read().bundleErrors.some((error) => error.includes("Duplicate newest assignment"))).toBe(true);
    rmSync(join(run.root, "duplicate"), { recursive: true });
    run.bundle("foreign-source", 1, "900/1", true);
    const file = join(run.root, "foreign-source/execution.json");
    const foreign = JSON.parse(readFileSync(file, "utf8"));
    foreign.results[0].source.tree = "other-tree";
    writeFileSync(file, JSON.stringify(foreign));
    expect(run.read().bundleErrors.some((error) => error.includes("Stale run identity"))).toBe(true);
  } finally {
    run.close();
  }
});

test("a superseded observation still rejects a foreign record plan digest", () => {
  const run = fixture();
  try {
    run.bundle("retained", 0, "900/1", true);
    run.bundle("old", 1, "900/1", true);
    run.bundle("current", 1, "900/2", true);
    const file = join(run.root, "old/execution.json");
    const foreign = JSON.parse(readFileSync(file, "utf8"));
    foreign.results[0].planDigest = "foreign-plan";
    writeFileSync(file, JSON.stringify(foreign));
    expect(run.read().bundleErrors.some((error) => error.includes("Stale run identity"))).toBe(true);
  } finally {
    run.close();
  }
});
