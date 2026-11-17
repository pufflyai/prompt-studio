import { integrationCoverage } from "./coverage-ownership";
import { windowsSourceContract } from "./native-source-coverage";
import { type TestPlan, validateTestPlan } from "./test-plan";

// Compare source-controlled selections without transferring a passing result.
// Replacements keep the exact test file; splitting/removing assertions requires
// a separate reviewed case migration before this inventory can accept it.
const excludedOnHost = (file: string, platform: string) =>
  file.endsWith("/packaged-folder-picker.p2.spec.ts") && platform !== "win32";

export const coverageMigration = (before: TestPlan, after: TestPlan) => {
  validateTestPlan(before);
  validateTestPlan(after);
  const rows = before.runs.flatMap((run) =>
    run.files.map((file) => {
      const candidates = after.runs.filter(
        (candidate) => candidate.files.includes(file) && candidate.lane === run.lane,
      );
      const sameHost = candidates.find(
        (candidate) => candidate.target.platform === run.target.platform && candidate.target.arch === run.target.arch,
      );
      const rule = integrationCoverage(file);
      const nativeSource = run.target.platform === "win32" && windowsSourceContract(file);
      const requiredHere =
        nativeSource ||
        (rule.targets.includes(`${run.target.platform}-${run.target.arch}`) && rule.surface.startsWith("native"));
      const replacement =
        sameHost ??
        candidates.find((candidate) => candidate.target.platform === "linux" && candidate.target.arch === "x64");
      const quarantineIds = run.quarantineIds.filter((id) => id.startsWith(`${file}:`));
      const quarantineKept = quarantineIds.every((id) => sameHost?.quarantineIds.includes(id));
      // This file already reports no cases outside Windows through an explicit skip.
      const excluded = excludedOnHost(file, run.target.platform);
      const missing = !replacement || (requiredHere && !sameHost) || (run.lane === "quarantine" && !quarantineKept);
      let disposition = sameHost ? "retained" : "consolidated";
      if (missing) disposition = "missing";
      if (excluded) disposition = "excluded";
      return {
        file,
        previousRunId: run.id,
        previousTarget: run.target,
        lane: run.lane,
        disposition,
        replacement: replacement && {
          file,
          runId: replacement.id,
          target: replacement.target,
          artifact: replacement.artifact,
        },
        reason: nativeSource ? nativeSource.reason : rule.reason,
        quarantineIds,
      };
    }),
  );
  return {
    beforeDigest: before.digest,
    afterDigest: after.digest,
    complete: rows.every((row) => row.disposition !== "missing"),
    rows,
  };
};

if (import.meta.main) {
  const before = await Bun.file(process.argv[2]!).json();
  const after = await Bun.file(process.argv[3]!).json();
  const result = coverageMigration(before, after);
  await Bun.write(process.argv[4] ?? "test-results/ci/coverage-migration.json", `${JSON.stringify(result, null, 2)}\n`);
  if (!result.complete)
    throw new Error("Coverage migration has missing exact replacements or native quarantine evidence");
}
