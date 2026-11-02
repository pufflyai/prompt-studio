import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { PLATFORMS, runsOn, SUITES } from "./platforms";

const ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

// The pages cannot import packages/benchmarks, so they keep a copy of its suite list. CI plans jobs from the
// package's describe command, so a drifted copy would hide a suite or promise jobs CI never starts.
test("the Runs page offers the suites CI runs on each platform", () => {
  for (const { id: platform } of PLATFORMS) {
    const described = Bun.spawnSync(["bun", "packages/benchmarks/src/cli.ts", "describe", "--platform", platform], {
      cwd: ROOT,
    });
    const suites = JSON.parse(described.stdout.toString()) as { id: string; label: string }[];
    expect(
      SUITES.filter((suite) => runsOn(suite, platform)).map((suite) => [suite.id, suite.label]),
      platform,
    ).toEqual(suites.map((suite) => [suite.id, suite.label]));
  }
});
