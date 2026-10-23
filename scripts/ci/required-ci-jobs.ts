import type { resolveCiScope } from "./pull-request-ci-scope";

export const requiredCiJobs = (scope: ReturnType<typeof resolveCiScope>) => {
  const jobs = ["scope", "static_checks"];
  if (scope.packageChecks) jobs.push("lint", "unit_tests");
  const selected = {
    build_docker: scope.dockerBuild,
    relay_smoke: scope.relaySmoke,
    database_tests: scope.databaseTests,
    published_extensions: scope.publishedExtensions,
    harness_cli_support: scope.harnessCli,
    license_check: scope.license,
    browser_smoke: scope.browserSmoke,
    browser_regressions: scope.browserChecks.length > 0,
    native_contracts: scope.nativeChecks.length > 0,
  };
  for (const [job, required] of Object.entries(selected)) if (required) jobs.push(job);
  if (scope.stage !== "pull_request") jobs.push("build_clients");
  if (scope.stage === "full") {
    jobs.push(
      "windows_test_and_build",
      "windows_database_tests",
      "storybooks",
      "e2e",
      "e2e_cli",
      "packaged_and_vite_e2e",
      "packaged_toolchain",
    );
  }
  return jobs;
};

export const requireCiJobs = (required: string[], results: Record<string, { result: string }>) => {
  if (!required.includes("scope") || !required.includes("static_checks"))
    throw new Error("Required CI scope is incomplete");
  for (const [name, job] of Object.entries(results)) {
    if (["quarantined_bun_tests", "quarantined_browser_tests"].includes(name)) continue;
    if (["failure", "cancelled"].includes(job.result)) throw new Error(`${name}: ${job.result}`);
  }
  for (const name of required) {
    if (results[name]?.result !== "success") throw new Error(`${name}: ${results[name]?.result ?? "missing"}`);
  }
};

if (import.meta.main) {
  requireCiJobs(JSON.parse(process.env.REQUIRED_JOBS ?? "[]"), JSON.parse(process.env.CI_RESULTS ?? "{}"));
}
