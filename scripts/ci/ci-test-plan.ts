import { selectBrowserSmokeFiles } from "./browser-smoke-selection";
import type { CiPlanRequest } from "./ci-native-test-plan";
import { nativeCiRequests } from "./ci-native-test-plan";
import { nativeSourceGroups, selectWindowsSourceContracts } from "./native-source-coverage";
import type { resolveCiScope } from "./pull-request-ci-scope";
import type { TestPackage } from "./runner-profiles";
import { priorityFromFile, testRunner } from "./test-discovery";
import { createTestPlan, mergeTestPlans, type PlanInput, type SourceIdentity, sealTestPlan } from "./test-plan";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";
import { createTestRuns } from "./test-runs";
import type { TestTimingSnapshot } from "./test-timing-snapshot";

type Scope = ReturnType<typeof resolveCiScope>;
export const createCiTestPlan = (
  scope: Scope,
  packages: TestPackage[],
  tests: string[],
  source: SourceIdentity,
  target = { platform: "linux", arch: "x64" },
  timingSnapshot?: TestTimingSnapshot,
) => {
  const plans: ReturnType<typeof createTestPlan>[] = [];
  const emptyJobs: string[] = [];
  const add = (job: string, files: string[], extra: Partial<PlanInput> = {}) => {
    if (!files.length) emptyJobs.push(job);
    else {
      const plan = createTestPlan({
        source,
        target,
        timingSnapshot,
        coverage: scope.sourceCoverage,
        packages,
        files,
        job,
        reason: `${scope.stage}: ${job}`,
        lane: "stable",
        ...extra,
      });
      if (!plan.runs.length) emptyJobs.push(job);
      plans.push(plan);
    }
  };
  const select = (owners: string[], priority: string, runner: string) =>
    owners.length
      ? createTestRuns(tests, packages, priority as "P0", { scope: owners.join(","), runner }).flatMap(
          (run) => run.files,
        )
      : [];
  add("repository", select(["repository"], "P0", "bun"));
  for (const row of scope.packageMatrix)
    add(
      `package-${row.shard}`,
      select(
        row.packages.filter((owner) => !["pstdio-api", "pstdio-db"].includes(owner)),
        "P0",
        "bun",
      ),
    );
  for (const row of scope.databaseMatrix) {
    const owner = packages.find((pkg) => pkg.name === row.package)!;
    add(
      `database-${row.package}-${row.priority}-${row.shard}`,
      (JSON.parse(row.files) as string[]).map((file) => `${owner.dir}/${file}`),
    );
  }
  for (const [kind, rows, runner] of [
    ["contracts", scope.bunContractMatrix, "bun"],
    ["integrations", scope.integrationMatrix, "integration"],
  ] as const)
    for (const row of rows) add(`${kind}-${row.priority}-${row.shard}`, select(row.packages, row.priority, runner));
  if (scope.browserSmoke) add("smoke", selectBrowserSmokeFiles(tests), { smoke: true });
  for (const request of editedRequests(scope)) add(request.job, request.files, request.extra);
  for (const row of scope.componentMatrix)
    add(
      `component-${row.package}-${row.priority}`,
      (JSON.parse(row.files) as string[]).map((file) => `packages/canvas-tests/${file}`),
    );
  for (const row of scope.appMatrix) {
    const job = `app-${row.priority}-${row.shard}`;
    add(
      job,
      (JSON.parse(row.files) as string[]).map((file) => `packages/e2e/${file}`),
      { shard: `${row.shard}/${row.total}` },
    );
    if (row.shard === 1 && row.priority === "P1")
      add(
        job,
        tests.filter((file) => testRunner(file) === "browser-helper" && priorityFromFile(file) === "P1"),
      );
  }
  for (const row of scope.packagedMatrix)
    add(
      `packaged-${row.suite}-${row.priority}-${row.shard}`,
      (JSON.parse(row.files) as string[]).map((file) => `packages/e2e/${file}`),
      { shard: row.shard },
    );
  if (scope.production && !scope.windowsOnly && scope.harnessCli)
    add(
      "cli",
      tests.filter((file) => testRunner(file) === "cli" && priorityFromFile(file) !== "P3"),
    );
  for (const request of windowsRequests(scope, tests, packages)) add(request.job, request.files, request.extra);
  for (const request of nativeCiRequests(scope, tests)) add(request.job, request.files, request.extra);
  const { digest: _digest, ...body } = mergeTestPlans(plans, source);
  return sealTestPlan({ ...body, emptyJobs });
};

const windowsRequests = (scope: Scope, tests: string[], packages: TestPackage[]) => {
  const requests: CiPlanRequest[] = [];
  if (!scope.windows) return requests;
  for (const group of nativeSourceGroups)
    for (const priority of ["P0", "P1", "P2"] as const)
      for (const run of createTestRuns(selectWindowsSourceContracts(tests, group), packages, priority))
        requests.push({
          job: `windows-native-${group}`,
          files: run.files,
          extra: {
            target: { platform: "win32", arch: "x64" },
            windowsAllowance: !["pstdio-wt", "pstdio-api"].includes(run.owner),
          },
        });
  return requests;
};

const editedRequests = (scope: Scope) => {
  const requests: CiPlanRequest[] = [];
  for (const [index, row] of scope.editedMatrix.entries()) {
    const files = JSON.parse(row.files) as string[];
    if (row.stable)
      requests.push({
        job: `edited-${index}`,
        files,
        extra: {
          target: { platform: row.platform, arch: row.arch },
          independentFiles: true,
          lane: row.suite ? "ordered" : "stable",
        },
      });
    if (row.quarantine && !row.suite)
      requests.push({
        job: `edited-${index}`,
        files: files.filter((file) =>
          quarantineRegistry.some(
            (entry) =>
              entry.file === file &&
              entry.runner === quarantineRunnerForTest(row.runner) &&
              matchesPlatform(entry, row.platform, row.arch),
          ),
        ),
        extra: { target: { platform: row.platform, arch: row.arch }, independentFiles: true, lane: "quarantine" },
      });
  }
  return requests;
};
