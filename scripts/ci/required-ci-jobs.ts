import type { resolveCiScope } from "./pull-request-ci-scope";
import { priorityForJob } from "./test-policy";

export const requiredCiJobs = (scope: ReturnType<typeof resolveCiScope>) => {
  const jobs = ["scope", "static_checks"];
  if (scope.packageChecks) jobs.push("package_checks");
  if (scope.production) jobs.push("quarantined_bun_tests");
  const selected = {
    build_docker: scope.dockerBuild,
    relay_smoke: scope.relaySmoke,
    database_tests: scope.databaseTests,
    published_extensions: scope.publishedExtensions,
    harness_cli_support: scope.harnessCli,
    license_check: scope.license,
    browser_smoke: scope.browserSmoke,
    browser_regressions: scope.browserChecks.length > 0,
    sdk_api_report: scope.sdkApiReport,
    storybooks: scope.componentChecks,
    storybook_tests: scope.componentChecks,
  };
  for (const [job, required] of Object.entries(selected)) if (required) jobs.push(job);
  if (["merge_queue", "full"].includes(scope.stage)) {
    jobs.push("build_clients", "e2e", "e2e_cli", "packaged_and_vite_e2e", "packaged_toolchain");
  }
  if (scope.production) {
    jobs.push("windows_test_and_build", "windows_database_tests", "quarantined_browser_tests");
  }
  return jobs;
};

export const plannedCiJobs = (
  scope: ReturnType<typeof resolveCiScope>,
  databaseMatrix?: Array<{ package: string; shard: string }>,
) => {
  const shards = (id: string, count: number) => Array.from({ length: count }, (_, index) => `${id} (${index + 1})`);
  const packageShards = (id: string, pkg: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${id} (${pkg} ${index + 1}/${count})`);
  const names: Record<string, string[]> = {
    package_checks: scope.packageMatrix.map((row) => `package_checks (${row.shard})`),
    database_tests: databaseMatrix?.map((row) => `database_tests (${row.package} ${row.shard})`) ?? [
      ...packageShards("database_tests", "pstdio-api", 4),
      ...packageShards("database_tests", "pstdio-db", 3),
    ],
    windows_test_and_build: ["lint", "unit-1", "unit-2", "unit-3", "unit-4"].map(
      (lane) => `windows_test_and_build (${lane})`,
    ),
    windows_database_tests: [
      ...packageShards("windows_database_tests", "pstdio-api", 8),
      ...packageShards("windows_database_tests", "pstdio-db", 4),
    ],
    storybook_tests: shards("storybook_tests", scope.componentShards),
    storybooks: ["ui", "pstdio-dashboard", "pstdio-workbench"].map((owner) => `storybooks (${owner})`),
    browser_regressions: shards("browser_regressions", Math.ceil(scope.browserChecks.length / 2)),
    e2e: shards("e2e", 6),
    packaged_and_vite_e2e: [
      ...packageShards("packaged_and_vite_e2e", "cli", 2),
      ...packageShards("packaged_and_vite_e2e", "browser", 3),
      "packaged_and_vite_e2e (vite 1/1)",
    ],
    quarantined_bun_tests: ["ubuntu-latest", "windows-latest"].map((os) => `quarantined_bun_tests (${os})`),
    build_clients: ["linux-x64", "darwin-arm64", "darwin-x64", ...(scope.production ? ["win32-x64"] : [])].map(
      (target) => `build_clients (${target})`,
    ),
    build_docker: ["pstdio/landing-page", "pstdio/api"].map((image) => `build_docker (${image})`),
    harness_cli_support: ["harness-codex", "harness-claude-code", "harness-open-code"].flatMap((harness) =>
      ["minimum", "latest"].map((version) => `harness_cli_support / ${harness} (${version})`),
    ),
    packaged_toolchain: [
      "cli-linux-x64",
      "cli-darwin-x64",
      ...(scope.production ? ["cli-linux-arm64", "cli-darwin-arm64", "cli-win-x64", "cli-win-arm64"] : []),
    ].map((platform) => `packaged_toolchain / verify (${platform})`),
  };
  return requiredCiJobs(scope).map((id) => ({
    id,
    count: names[id]?.length ?? 1,
    names: names[id] ?? [id],
    priority: scope.production && id === "packaged_toolchain" ? ("P2" as const) : priorityForJob(id),
  }));
};
