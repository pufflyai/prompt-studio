import type { resolveCiScope } from "./pull-request-ci-scope";
import { type PlannedJob, priorityForJob, type TestPriority } from "./test-policy";

type Scope = ReturnType<typeof resolveCiScope>;
const matrixPlan = <T extends { priority: TestPriority }>(id: string, rows: T[], label: (row: T) => string) => {
  return [...new Set(rows.map((row) => row.priority))].map((priority) => {
    const name = `${id}_${priority}`;
    const names = rows.filter((row) => row.priority === priority).map((row) => `${name} (${label(row)})`);
    return { id: name, priority, count: names.length, names };
  });
};

export const plannedCiJobs = (scope: Scope) => {
  const jobs: PlannedJob[] = [];
  const add = (id: string, names = [id], priority = priorityForJob(id)) =>
    jobs.push({ id, priority, count: names.length, names });
  add("scope");
  add("static_checks");
  if (scope.packageChecks)
    add(
      "package_checks",
      scope.packageMatrix.map((row) => `package_checks (${row.shard})`),
    );
  for (const [id, selected] of Object.entries({
    published_extensions: scope.publishedExtensions,
    license_check: scope.license,
    browser_smoke: scope.browserSmoke,
    sdk_api_report: scope.sdkApiReport,
  }))
    if (selected) add(id);
  jobs.push(...matrixPlan("database_tests", scope.databaseMatrix, (row) => `${row.package} ${row.shard}`));
  jobs.push(...matrixPlan("bun_contracts", scope.bunContractMatrix, (row) => row.shard));
  jobs.push(...matrixPlan("integration_contracts", scope.integrationMatrix, (row) => row.package));
  jobs.push(...matrixPlan("storybooks", scope.componentMatrix, (row) => row.package));
  if (["merge_queue", "full"].includes(scope.stage)) {
    jobs.push(...matrixPlan("e2e", scope.appMatrix, (row) => `${row.shard}/${row.total}`));
    jobs.push(...matrixPlan("packaged_and_vite_e2e", scope.packagedMatrix, (row) => `${row.suite} ${row.shard}`));
    add("e2e_cli", ["e2e_cli"], scope.production ? "P2" : "P1");
    add(
      "build_clients",
      scope.clientMatrix.map((row) => `build_clients (${row.target})`),
      scope.production ? "P2" : "P1",
    );
    if (scope.production)
      add(
        "packaged_toolchain",
        scope.toolchainMatrix.map((row) => `packaged_toolchain / verify (${row.platform_pkg})`),
        "P2",
      );
  }
  if (scope.harnessCli)
    add(
      "harness_cli_support",
      ["harness-codex", "harness-claude-code", "harness-open-code"].flatMap((harness) =>
        ["minimum", "latest"].map((version) => `harness_cli_support / ${harness} (${version})`),
      ),
      "P2",
    );
  if (scope.dockerBuild)
    add(
      "build_docker",
      ["pstdio/landing-page", "pstdio/api"].map((image) => `build_docker (${image})`),
      "P2",
    );
  if (scope.production) {
    add(
      "windows_test_and_build",
      ["lint", "unit-1", "unit-2", "unit-3", "unit-4"].map((lane) => `windows_test_and_build (${lane})`),
      "P2",
    );
    add(
      "windows_database_tests",
      [
        { name: "pstdio-api", count: 8 },
        { name: "pstdio-db", count: 4 },
      ].flatMap((pkg) =>
        Array.from(
          { length: pkg.count },
          (_, index) => `windows_database_tests (${pkg.name} ${index + 1}/${pkg.count})`,
        ),
      ),
      "P2",
    );
    add(
      "quarantined_bun_tests",
      ["ubuntu-latest", "windows-latest"].map((os) => `quarantined_bun_tests (${os})`),
      "P2",
    );
    add("quarantined_browser_tests", ["quarantined_browser_tests"], "P2");
  }
  return jobs;
};
export const requiredCiJobs = (scope: Scope) => plannedCiJobs(scope).map((job) => job.id);
