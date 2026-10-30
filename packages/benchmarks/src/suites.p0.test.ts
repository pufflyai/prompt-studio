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
