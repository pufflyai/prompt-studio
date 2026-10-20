import { expect, test } from "bun:test";
import { affectedPackages } from "./ci-packages";

const packages = [
  { name: "@pstdio/sdk", dir: "packages/sdk", dependencies: [] },
  { name: "extension", dir: "extensions/example", dependencies: ["@pstdio/sdk"] },
  { name: "runtime", dir: "packages/runtime", dependencies: ["extension"] },
  { name: "unrelated", dir: "clients/site", dependencies: [] },
];

test("a change selects its package and transitive runtime consumers", () => {
  expect(affectedPackages(packages, ["packages/sdk/src/index.ts"])).toEqual(["@pstdio/sdk", "extension", "runtime"]);
});

test("the union of PR files keeps checks when queued changes cancel each other", () => {
  expect(affectedPackages(packages, ["packages/sdk/src/index.ts", "clients/site/README.md"])).toEqual([
    "@pstdio/sdk",
    "extension",
    "runtime",
    "unrelated",
  ]);
});

test("paths outside packages do not accidentally match a prefix", () => {
  expect(affectedPackages(packages, ["packages/sdk-other/src/index.ts", "README.md"])).toEqual([]);
});
