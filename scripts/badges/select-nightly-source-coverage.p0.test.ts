import { expect, test } from "bun:test";
import { selectNightlySourceCoverage } from "./select-nightly-source-coverage";

const run = { id: 200, name: "Release Packages", head_branch: "main", conclusion: "success", run_attempt: 2 };
const artifact = { id: 12, name: "nightly-source-coverage-attempt-2", expired: false };

test("publishes only the complete nightly artifact from the selected successful main run attempt", () => {
  expect(selectNightlySourceCoverage(run, [artifact], 100, false)).toEqual({ runId: 200, artifactId: 12 });
  for (const invalid of [{ name: "Test and Build" }, { head_branch: "feature/source" }, { conclusion: "failure" }])
    expect(() => selectNightlySourceCoverage({ ...run, ...invalid }, [artifact], 0, false)).toThrow();
  expect(() => selectNightlySourceCoverage(run, [artifact, artifact], 0, false)).toThrow("Ambiguous");
});

test("automatic stable runs skip missing coverage while an explicit publication must find its measurement", () => {
  expect(selectNightlySourceCoverage(run, [], 0, false)).toBeUndefined();
  for (const artifacts of [
    [],
    [{ ...artifact, expired: true }],
    [{ ...artifact, name: "nightly-source-coverage-attempt-1" }],
  ])
    expect(() => selectNightlySourceCoverage(run, artifacts, 0, true)).toThrow("No unexpired");
});

test("an older nightly cannot replace the published measurement, including after a rerun", () => {
  expect(selectNightlySourceCoverage(run, [artifact], 300, false)).toBeUndefined();
  expect(() => selectNightlySourceCoverage(run, [artifact], 300, true)).toThrow("older");
  expect(
    selectNightlySourceCoverage(
      { ...run, run_attempt: 3 },
      [{ ...artifact, name: "nightly-source-coverage-attempt-3" }],
      300,
      false,
    ),
  ).toBeUndefined();
  expect(selectNightlySourceCoverage(run, [artifact], 200, false)).toEqual({ runId: 200, artifactId: 12 });
});
