import { expect, test } from "bun:test";
import { suites } from "./suites";

const context = { root: "/checkout", cacheDir: "/cache", platform: "linux-x64", sha: "example" };

test("every suite selects every registered benchmark, including an added file", () => {
  for (const suite of suites) {
    const first = suite.files[0]!;
    const extra = first.replace(/[^/]+$/, "additional.p3.bench.ts");
    const commands = suite.sample(context, [...suite.files, extra]);
    expect(
      commands.some((step) => step.command.some((argument) => argument.endsWith("additional.p3.bench.ts"))),
      suite.id,
    ).toBe(true);
  }
});

// The Performance pages cannot import this package, so they keep a copy of the suite list. A drifted copy
// would hide a suite from the Runs page or promise jobs CI never starts.
test("the Performance pages offer every suite with the same platform limits", async () => {
  const { SUITES } = await import("../../../.pstdio/extensions/pstdio-dev/src/benchmarks/platforms");
  expect(SUITES.map((suite) => [suite.id, suite.label, suite.platforms])).toEqual(
    suites.map((suite) => [suite.id, suite.label, suite.platforms]),
  );
});
