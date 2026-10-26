import type { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs } from "./required-ci-jobs";

export const sourceCoverageArtifacts = (scope: ReturnType<typeof resolveCiScope>, attempt: number) => {
  if (!scope.sourceCoverage) return [];
  const plan = plannedCiJobs(scope);
  const windowsDatabase = plan.find((job) => job.id === "windows_database_tests")!.count;
  const windowsUnits = plan
    .find((job) => job.id === "windows_test_and_build")!
    .names!.flatMap((name) => {
      const shard = name.match(/unit-(\d+)/)?.[1];
      return shard ? [`windows_test_and_build-${shard}`] : [];
    });
  return [
    ...scope.packageMatrix.map((_, index) => `package_checks-${index}`),
    ...scope.bunContractMatrix.map((row, index) => `bun-contract-results-${row.priority}-${index}`),
    ...scope.databaseMatrix.map((_, index) => `database_tests-${index}`),
    ...windowsUnits,
    ...Array.from({ length: windowsDatabase }, (_, index) => `windows_database_tests-${index}`),
  ].map((name) => `${name}-attempt-${attempt}`);
};
