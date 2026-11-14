import { nativeSourceGroups } from "./native-source-coverage";
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

const quarantinePlan = (scope: Scope) => {
  if (!scope.production) return [];
  const names = scope.quarantineBunOs.map((os) => `quarantined_bun_tests (${os})`);
  return [
    ...(names.length ? [{ id: "quarantined_bun_tests", priority: "P2" as const, count: names.length, names }] : []),
    ...(scope.diagnosticPlatform === "win32" || !scope.quarantineBunOs.length
      ? []
      : ["quarantined_native_ui_tests", ...(!scope.diagnosticPlatform ? ["quarantined_browser_tests"] : [])]
    ).map((id) => ({
      id,
      priority: "P2" as const,
      count: 1,
      names: [id],
    })),
  ];
};

const linuxCliSelected = (scope: Scope) => scope.harnessCli && !scope.diagnosticPlatform;

export const plannedCiJobs = (scope: Scope) => {
  const jobs: PlannedJob[] = [];
  const add = (id: string, names = [id], priority = priorityForJob(id)) =>
    jobs.push({ id, priority, count: names.length, names });
  add("scope");
  add("static_checks");
  if (scope.editedMatrix.length)
    add(
      "edited_tests",
      scope.editedMatrix.map((row) => `edited_tests (${row.name})`),
      "P0",
    );
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
    source_coverage: scope.sourceCoverage,
  }))
    if (selected) add(id);
  jobs.push(...matrixPlan("database_tests", scope.databaseMatrix, (row) => `${row.package} ${row.shard}`));
  jobs.push(...matrixPlan("bun_contracts", scope.bunContractMatrix, (row) => row.shard));
  if (scope.sharedBuild) add("build_host", ["build_host"], "P0");
  jobs.push(...matrixPlan("integration_contracts", scope.integrationMatrix, (row) => row.shard));
  jobs.push(...matrixPlan("components", scope.componentMatrix, (row) => row.package));
  if (scope.clientMatrix.length)
    add(
      "build_clients",
      scope.clientMatrix.map((row) => `build_clients (${row.target} ${row.shard}/${row.shards})`),
      scope.production ? "P2" : "P1",
    );
  jobs.push(...matrixPlan("packaged_and_vite_e2e", scope.packagedMatrix, (row) => `${row.suite} ${row.shard}`));
  if (scope.stage === "full") {
    jobs.push(...matrixPlan("e2e", scope.appMatrix, (row) => `${row.shard}/${row.total}`));
    if (linuxCliSelected(scope)) add("e2e_cli", ["e2e_cli"], scope.production ? "P2" : "P1");
    if (scope.production)
      add(
        "packaged_toolchain",
        scope.toolchainMatrix.map(
          (row) => `packaged_toolchain / verify (${row.platform_pkg} ${row.shard}/${row.shards})`,
        ),
        "P2",
      );
  }
  if (scope.harnessCli)
    add(
      "harness_cli_support",
      scope.harnessMatrix.flatMap((lane) =>
        ["minimum", "latest"].map(
          (version) => `harness_cli_support / ${lane.extension} (${version}${"os" in lane ? ", Windows" : ""})`,
        ),
      ),
      "P2",
    );
  if (scope.dockerBuild)
    add(
      "build_docker",
      ["pstdio/landing-page", "pstdio/api"].map((image) => `build_docker (${image})`),
      "P2",
    );
  if (scope.windows)
    add(
      "windows_native_contracts",
      nativeSourceGroups.map((group) => `windows_native_contracts (${group})`),
      "P2",
    );
  jobs.push(...quarantinePlan(scope));
  return jobs;
};
export const requiredCiJobs = (scope: Scope) => plannedCiJobs(scope).map((job) => job.id);
