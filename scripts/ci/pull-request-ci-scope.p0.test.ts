import { expect, test } from "bun:test";
import { scopeFixture } from "./ci-scope.test-fixture";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs } from "./required-ci-jobs";
import { sourceCoverageArtifacts } from "./source-coverage-artifacts";

test("both gates include edited behavior tests and the same dependency scope", () => {
  const input = scopeFixture();
  const file = "packages/e2e/src/ui/feature.p2.spec.ts";
  const pr = resolveCiScope({ ...input, changedFiles: [file] });
  const queue = resolveCiScope({ ...input, changedFiles: [file], event: "merge_group" });
  expect(pr.editedMatrix.flatMap((row) => JSON.parse(row.files))).toEqual([file]);
  expect(queue.editedMatrix).toEqual(pr.editedMatrix);
  expect(plannedCiJobs(queue)).toEqual(plannedCiJobs(pr));
});

test("all fast units run while source contracts follow affected production dependencies", () => {
  const scope = resolveCiScope(scopeFixture());
  expect(scope.affectedOwners).toEqual(["e2e", "example", "pstdio-api"]);
  expect(scope.databaseMatrix.map((row) => row.priority)).toEqual(["P0", "P1"]);
  expect(scope.packageMatrix.flatMap((row) => row.packages).sort()).toEqual(
    scopeFixture()
      .packages.map((pkg) => pkg.name)
      .sort(),
  );
  expect(scope.clientMatrix.map((row) => row.target)).toEqual(["linux-x64"]);
  expect(scope.clientMatrix[0]).toMatchObject({ tests: false, packaged: true });
  expect(scope.componentMatrix).toEqual([]);
  expect(scope.windows).toBe(false);
  expect(scope.toolchainMatrix).toEqual([]);
});

test("shared inputs cover all owners without adding routine native or performance matrices", () => {
  const scope = resolveCiScope({ ...scopeFixture(), changedFiles: ["bun.lock"] });
  expect(scope.affectedOwners).toHaveLength(scopeFixture().packages.length);
  expect(scope.componentMatrix).toEqual([]);
  expect(scope.appMatrix).toEqual([]);
  expect(scope.windows).toBe(false);
  expect(scope.harnessCli).toBe(false);
  expect(scope.dockerBuild).toBe(false);
  expect(scope.editedMatrix.some((row) => row.priority === "P3")).toBe(false);
});

test("prose has the same fast baseline and packaged smoke without affected feature journeys", () => {
  const scope = resolveCiScope({ ...scopeFixture(), changedFiles: ["documentation/guide.md"] });
  expect(scope.affectedOwners).toEqual([]);
  expect(scope.packageChecks).toBe(true);
  expect(scope.databaseMatrix.every((row) => row.priority === "P0")).toBe(true);
  expect(scope.packagedMatrix).toEqual([]);
  expect(scope.sharedBuild).toBe("");
});

test("nightly native diagnostics include Windows without adding a Windows publication", async () => {
  const input = { ...scopeFixture(), event: "workflow_dispatch", profile: "production" };
  const nightly = resolveCiScope({ ...input, releaseChannel: "nightly", signedCandidate: true });
  expect(nightly.clientMatrix.map((row) => row.target)).toEqual(["linux-x64", "darwin-arm64", "win32-x64"]);
  expect(nightly.clientMatrix.find((row) => row.platform === "win32")?.packaged).toBe(true);
  expect(nightly.clientMatrix.filter((row) => row.platform !== "win32").every((row) => !row.packaged)).toBe(true);
  expect(nightly.toolchainMatrix.map((row) => row.platform_pkg)).toEqual([
    "cli-linux-x64",
    "cli-darwin-arm64",
    "cli-win-x64",
  ]);
  expect(nightly.windows).toBe(true);
  const { publishedDesktopTargets } = await import("./production-platforms");
  expect(publishedDesktopTargets("nightly")).toEqual(["linux-x64", "darwin-arm64"]);
  expect(sourceCoverageArtifacts(nightly, 2).filter((name) => name.startsWith("database_tests-"))).toHaveLength(
    nightly.databaseMatrix.length,
  );
  expect(sourceCoverageArtifacts(resolveCiScope(scopeFixture()), 2)).toEqual([]);
});

test("stable certifies all six CLI artifacts with separate Linux shared behavior", () => {
  const scope = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  expect(scope.toolchainMatrix).toHaveLength(6);
  expect(scope.toolchainMatrix.every((row) => row.shards === 1)).toBe(true);
  expect(scope.packagedMatrix.some((row) => row.suite === "cli")).toBe(true);
  expect(scope.packagedMatrix.some((row) => row.suite === "browser")).toBe(true);
});

test("a signed stable candidate runs its native packaged desktop contract once on the signed bytes", () => {
  const scope = resolveCiScope({
    ...scopeFixture(),
    event: "workflow_dispatch",
    profile: "production",
    signedCandidate: true,
  });
  expect(scope.clientMatrix).toHaveLength(4);
  expect(scope.clientMatrix.every((row) => !row.packaged && row.shards === 1)).toBe(true);
});

test("Windows diagnostics keep focused contracts and reject signed or nightly publication claims", () => {
  const input = { ...scopeFixture(), event: "workflow_dispatch" };
  const scope = resolveCiScope({ ...input, profile: "windows" });
  expect(scope).toMatchObject({
    production: true,
    diagnosticPlatform: "win32",
    windows: true,
    packageChecks: false,
    databaseTests: false,
    dockerBuild: false,
    sharedBuild: "",
  });
  expect(scope.clientMatrix.every((row) => row.platform === "win32")).toBe(true);
  expect(scope.toolchainMatrix.every((row) => row.platform_pkg.startsWith("cli-win-"))).toBe(true);
  expect(scope.packagedMatrix).toEqual([]);
  expect(() => resolveCiScope({ ...input, profile: "windows", signedCandidate: true })).toThrow("signed");
  expect(() => resolveCiScope({ ...input, profile: "windows", releaseChannel: "nightly" })).toThrow("stable");
});

test("main keeps provenance and smoke, while production discovers the complete functional suite", () => {
  const input = scopeFixture();
  input.tests.push("packages/e2e/src/ui/new-contract.p1.spec.ts");
  expect(
    JSON.stringify(resolveCiScope({ ...input, event: "workflow_dispatch", profile: "production" }).appMatrix),
  ).toContain("new-contract.p1.spec.ts");
  const main = resolveCiScope({ ...input, event: "push" });
  expect(main).toMatchObject({ stage: "main", packageChecks: false, browserSmoke: true });
  expect(main.databaseMatrix).toEqual([]);
});

test("file integrity checks follow the actual combined diff in both gates", () => {
  const input = scopeFixture();
  const source = resolveCiScope(input);
  expect(source).toMatchObject({ license: false, publishedExtensions: false, sdkApiReport: false });
  const changedFiles = ["packages/ui/src/index.ts", "packages/ui/package.json"];
  for (const event of ["pull_request", "merge_group"])
    expect(resolveCiScope({ ...input, event, changedFiles })).toMatchObject({
      license: true,
      publishedExtensions: true,
      sdkApiReport: true,
    });
});

test("weekly compatibility exercises secondary artifacts without replaying shared Linux journeys", () => {
  const scope = resolveCiScope({ ...scopeFixture(), event: "schedule", profile: "compatibility" });
  expect(scope.production).toBe(true);
  expect(scope.clientMatrix.map((row) => row.target)).toEqual(["darwin-x64"]);
  expect(scope.toolchainMatrix.map((row) => row.platform_pkg)).toEqual([
    "cli-linux-arm64",
    "cli-darwin-x64",
    "cli-win-arm64",
  ]);
  expect(scope.appMatrix).toEqual([]);
  expect(scope.packagedMatrix).toEqual([]);
  expect(scope.windows).toBe(false);
  expect(scope.quarantineBunOs).toEqual([]);
  expect(plannedCiJobs(scope).some((job) => job.id === "e2e_cli")).toBe(false);
});
