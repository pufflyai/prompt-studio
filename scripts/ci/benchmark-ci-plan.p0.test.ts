import { expect, test } from "bun:test";
import { createBenchmarkCiPlan } from "./benchmark-ci-plan";
import { suites } from "./benchmark-registry";
import { productionDesktopPlatforms, productionPerformanceWorkloads } from "./production-platforms";
import { validateTestPlan } from "./test-plan";

const source = { sha: "candidate", tree: "tree", policy: "policy", dirty: false };

test("source benchmark qualification covers the registered inventory on production hosts", () => {
  for (const channel of ["stable", "nightly"]) {
    const { plan, matrix } = createBenchmarkCiPlan(source, [], channel);
    validateTestPlan(plan, source);
    expect(new Set(plan.runs.flatMap((run) => run.files))).toEqual(new Set(suites.flatMap((suite) => suite.files)));
    expect(new Set(matrix.map((row) => row.job)).size).toBe(matrix.length);
    expect(plan.runs.map((run) => run.job).sort()).toEqual(matrix.map((row) => row.job).sort());
    for (const row of productionDesktopPlatforms(channel))
      expect(matrix).toContainEqual({ ...row, suite: "desktop", job: `benchmark-${row.target}-desktop` });
    for (const row of productionPerformanceWorkloads(channel)) {
      let suite = row.family;
      if (suite === "navigation") suite = "subnav";
      if (suite === "browser") suite = "workbench";
      expect(matrix.some((selected) => selected.os === row.os && selected.suite === suite)).toBe(true);
    }
    const navigation = plan.runs.filter((run) => run.benchmarkSuite === "subnav");
    expect(navigation).toHaveLength(1);
    expect(navigation[0]).toMatchObject({
      lane: "ordered",
      runner: "performance",
      target: { platform: "linux", arch: "x64" },
    });
    expect(plan.runs.every((run) => run.artifact === "source" && run.requires.length === 0)).toBe(true);
  }
});
