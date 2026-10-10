import { expect, test } from "bun:test";
import { planNpmPublishing } from "./check-npm-publishing";

const pstdio = (version: string, npmVersions: string[]) => ({
  name: "pstdio",
  version,
  dir: "packages/pstdio",
  npmVersions,
});

test("publishes every public package whose version is not on npm yet", () => {
  expect(
    planNpmPublishing([
      pstdio("0.42.0", ["0.41.0"]),
      { name: "@pstdio/sdk", version: "0.42.0", dir: "packages/sdk", npmVersions: ["0.41.0"] },
      { name: "@pstdio/ui", version: "0.41.0", dir: "packages/ui", npmVersions: ["0.41.0"] },
    ]),
  ).toEqual({ publish: ["packages/pstdio", "packages/sdk"], problems: [] });
});

test("rejects a public package that does not exist on npm", () => {
  const plan = planNpmPublishing([
    pstdio("0.42.0", ["0.41.0"]),
    { name: "pstdio-artifacts", version: "0.42.0", dir: "extensions/pstdio-artifacts", npmVersions: null },
  ]);
  expect(plan.problems).toEqual([expect.stringContaining("pstdio-artifacts is not on npm")]);
});

test("rejects a release whose pstdio version is already published", () => {
  expect(planNpmPublishing([pstdio("0.41.0", ["0.41.0"])]).problems).toEqual([
    expect.stringContaining("pstdio@0.41.0 is already on npm"),
  ]);
});
