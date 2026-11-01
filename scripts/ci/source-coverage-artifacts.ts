import type { resolveCiScope } from "./pull-request-ci-scope";

export const sourceCoverageArtifacts = (scope: ReturnType<typeof resolveCiScope>, attempt: number) => {
  if (!scope.sourceCoverage) return [];
  return [
    ...scope.packageMatrix.map((_, index) => `package_checks-${index}`),
    ...scope.bunContractMatrix.map((row, index) => `bun-contract-results-${row.priority}-${index}`),
    ...scope.databaseMatrix.map((_, index) => `database_tests-${index}`),
  ].map((name) => `${name}-attempt-${attempt}`);
};
