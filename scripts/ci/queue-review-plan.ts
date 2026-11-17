import { createCiTestPlan } from "./ci-test-plan";
import { resolveCiScope } from "./pull-request-ci-scope";
import type { TestPackage } from "./runner-profiles";
import { createTestPlan, mergeTestPlans, type SourceIdentity } from "./test-plan";

// The review worker consumes the queue's actual runs; no matrix-to-files translation lives here.
export const queueReviewPlan = (
  packages: TestPackage[],
  tests: string[],
  changed: string[],
  source: SourceIdentity = { sha: "preview", tree: "preview", policy: "preview", dirty: false },
) => {
  const scope = resolveCiScope({ event: "merge_group", changedFiles: changed, packages, tests });
  const required = createCiTestPlan(scope, packages, tests, source);
  // Local execution proves the same selected files on its actual host. Only CI can
  // qualify the Linux artifact and ten-minute hosted result; never label a Mac pass Linux.
  const testPlan = mergeTestPlans(
    required.runs.map((run) =>
      createTestPlan({
        source,
        packages,
        files: run.files,
        target: { platform: process.platform, arch: process.arch },
        job: run.job,
        lane: run.lane,
        shard: run.shard,
        artifact: run.artifact,
        smoke: run.smoke,
        reason: `local ${process.platform}/${process.arch} projection of required profile`,
      }),
    ),
    source,
  );
  const smoke = testPlan.runs.filter((run) => run.smoke);
  const browser = packages.find((pkg) => pkg.name === "e2e");
  if (scope.browserSmoke && !browser?.scripts["test:smoke"])
    throw new Error("Queue coverage requires the e2e test:smoke command");
  return {
    testPlan,
    files: [...new Set(testPlan.runs.filter((run) => !run.smoke).flatMap((run) => run.files))].sort(),
    owners: scope.packageMatrix.flatMap((row) => row.packages),
    smokeFiles: [...new Set(smoke.flatMap((run) => run.files))],
    browserOwners: smoke.length
      ? packages.filter((pkg) => ["e2e", "pstdio-dashboard"].includes(pkg.name)).map((pkg) => pkg.name)
      : [],
  };
};
