import { createCiTestPlan } from "./ci-test-plan";
import { resolveCiScope } from "./pull-request-ci-scope";
import type { TestPackage } from "./runner-profiles";
import type { SourceIdentity } from "./test-plan";

// The review worker consumes the queue's actual runs; no matrix-to-files translation lives here.
export const queueReviewPlan = (
  packages: TestPackage[],
  tests: string[],
  changed: string[],
  source: SourceIdentity = { sha: "preview", tree: "preview", policy: "preview", dirty: false },
) => {
  const scope = resolveCiScope({ event: "merge_group", changedFiles: changed, packages, tests });
  if (
    scope.appMatrix.length ||
    scope.packagedMatrix.length ||
    scope.componentMatrix.length ||
    scope.clientMatrix.length ||
    scope.windows ||
    scope.harnessCli ||
    scope.dockerBuild
  )
    throw new Error("Merge queue added a validation lane; extend local queue coverage before running review");
  const testPlan = createCiTestPlan(scope, packages, tests, source, { platform: process.platform, arch: process.arch });
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
