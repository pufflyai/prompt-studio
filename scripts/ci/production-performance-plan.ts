import { productionPerformanceFiles } from "./production-performance-profile";
import { type PlannedRun, planHash, type SourceIdentity, sealTestPlan, type Target } from "./test-plan";
export const createProductionPerformancePlan = (
  family: string,
  source: SourceIdentity,
  target: Target,
  candidateSourceSha = source.sha,
) => {
  const files = productionPerformanceFiles(family);
  if (family === "relay") target = { platform: "linux", arch: "x64" };
  const run = {
    id: planHash({ family, source, target, candidateSourceSha }).slice(0, 24),
    owner: "benchmarks",
    cwd: ".",
    runner: "performance",
    componentOwner: undefined,
    priority: "P3",
    files,
    target,
    artifact: "signed-candidate",
    requires: [],
    reasons: ["complete fixed release workload"],
    lane: "ordered",
    quarantineIds: [],
    continueIndependentFiles: true,
    productionFamily: family,
    candidateSourceSha,
  } satisfies PlannedRun;
  return sealTestPlan({ version: 1, source, setup: [], runs: [run] });
};
