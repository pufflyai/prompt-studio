import { expect, test } from "bun:test";
import { scopeFixture } from "./ci-scope.test-fixture";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs } from "./required-ci-jobs";
import { sourceCoverageArtifacts } from "./source-coverage-artifacts";

test("an edited browser test is required on the PR even when its priority normally waits for production", () => {
  const input = scopeFixture();
  const file = "packages/e2e/src/ui/feature.p2.spec.ts";
  const scope = resolveCiScope({ ...input, changedFiles: [file] });
  expect(scope.editedMatrix).toEqual(
    expect.arrayContaining([expect.objectContaining({ priority: "P2", runner: "app", files: JSON.stringify([file]) })]),
  );
  expect(plannedCiJobs(scope).find((job) => job.id === "edited_tests")?.count).toBeGreaterThan(0);
});

test("a PR runs only the tests it edits beyond P0, and the queue runs none of them", () => {
  const input = scopeFixture();
  const file = "packages/e2e/src/ui/feature.p2.spec.ts";
  const changedFiles = [
    file,
    "packages/e2e/src/ui/helpers/camera.ts",
    "packages/e2e/src/packaged/registry.fixture.ts",
    "packages/e2e/src/packaged/run-packaged-cli-tests.ts",
    "packages/e2e/src/ui/removed.p1.spec.ts",
  ];
  const scope = resolveCiScope({ ...input, changedFiles });
  expect(scope.editedMatrix.flatMap((row) => JSON.parse(row.files))).toEqual([file]);
  expect(resolveCiScope({ ...input, changedFiles, event: "merge_group" }).editedMatrix).toEqual([]);
});

test("PR selection follows affected package dependencies without test filename lists", () => {
  const scope = resolveCiScope(scopeFixture());
  expect(scope.stage).toBe("pull_request");
  expect(scope.affectedOwners).toEqual(["e2e", "example", "pstdio-api"]);
  expect(scope.databaseMatrix.every((row) => row.package === "pstdio-api")).toBe(true);
  expect(scope.browserSmoke).toBe(false);
  expect(scope.componentMatrix).toHaveLength(0);
  expect(scope.databaseMatrix.map((row) => row.priority)).toEqual(["P0"]);
  expect(scope.integrationMatrix).toEqual([]);
  expect(scope.bunContractMatrix).toEqual([]);
  expect(JSON.stringify(scope)).not.toContain("feature.p2");
});

test("PRs select focused P0 rules and the required queue adds source contracts and startup smoke", () => {
  const input = { ...scopeFixture(), changedFiles: ["scripts/ci/run-package-checks.ts"] };
  const pr = resolveCiScope(input);
  expect(pr.databaseMatrix.every((row) => row.priority === "P0")).toBe(true);
  expect(pr.componentMatrix).toEqual([]);
  expect(pr.appMatrix).toEqual([]);
  expect(plannedCiJobs(pr).every((job) => job.priority === "P0")).toBe(true);
  const queue = resolveCiScope({ ...input, event: "merge_group" });
  expect(queue.databaseMatrix.some((row) => row.priority === "P1")).toBe(true);
  expect(queue.appMatrix).toEqual([]);
  expect(queue.browserSmoke).toBe(true);
  expect(queue.componentMatrix).toEqual([]);
});

test("the queue keeps source contracts and smoke while production retains complete functional suites", () => {
  const queue = resolveCiScope({ ...scopeFixture(), event: "merge_group" });
  expect(queue.stage).toBe("merge_queue");
  expect(plannedCiJobs(queue).map((job) => job.id)).toContain("browser_smoke");
  expect(
    plannedCiJobs(queue)
      .filter((job) => job.priority === "P1")
      .map((job) => job.id),
  ).toEqual(expect.arrayContaining(["browser_smoke", "database_tests_P1"]));
  expect(plannedCiJobs(queue).some((job) => /^(e2e|components|build_clients)/.test(job.id))).toBe(false);
  expect(queue.appMatrix).toEqual([]);
  expect(queue.componentMatrix).toEqual([]);
  expect(JSON.stringify(queue)).not.toContain("feature.p2");
  const production = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  expect(production.databaseMatrix.some((row) => row.priority === "P1")).toBe(true);
  expect(production.componentMatrix.some((row) => row.priority === "P1")).toBe(true);
  expect(production.appMatrix.some((row) => row.priority === "P2")).toBe(true);
  expect(production.packagedMatrix.some((row) => row.priority === "P2")).toBe(true);
});

test("a dispatched pull_request profile runs the same checks as the PR itself", () => {
  const input = { ...scopeFixture(), changedFiles: ["packages/sdk/package.json"] };
  const pull = resolveCiScope({ ...input, event: "pull_request" });
  const dispatched = resolveCiScope({ ...input, event: "workflow_dispatch", profile: "pull_request" });
  expect(dispatched).toEqual(pull);
  expect(dispatched).toMatchObject({ stage: "pull_request", production: false });
});

test("the nightly validates Linux and Apple Silicon while stable releases validate every published host", () => {
  const input = { ...scopeFixture(), event: "workflow_dispatch", profile: "production" };
  const queue = resolveCiScope({ ...input, profile: "merge_queue" });
  const nightly = resolveCiScope({ ...input, releaseChannel: "nightly" });
  const stable = resolveCiScope({ ...input, releaseChannel: "stable" });
  expect(queue.clientMatrix).toEqual([]);
  expect(nightly.clientMatrix.map((row) => row.target)).toEqual(["linux-x64", "darwin-arm64"]);
  expect(stable.clientMatrix.map((row) => row.target)).toEqual(expect.arrayContaining(["darwin-x64", "win32-x64"]));
  expect(nightly.toolchainMatrix.map((row) => row.platform_pkg)).toEqual([
    "cli-linux-x64",
    "cli-linux-arm64",
    "cli-darwin-arm64",
  ]);
  expect(stable.toolchainMatrix.map((row) => row.platform_pkg)).toEqual(
    expect.arrayContaining(["cli-darwin-x64", "cli-win-x64", "cli-win-arm64"]),
  );
  expect(nightly.quarantineBunOs).toEqual(["ubuntu-latest", "macos-15"]);
  expect(stable.quarantineBunOs).toContain("windows-latest");
  const nightlyJobs = JSON.stringify(plannedCiJobs(nightly));
  for (const name of ["windows", "win32", "cli-win", "darwin-x64"]) expect(nightlyJobs).not.toContain(name);
  expect(JSON.stringify(plannedCiJobs(stable))).toContain("windows_test_and_build");
  expect(JSON.stringify(plannedCiJobs(stable))).toContain("harness-pi (latest, Windows)");
  expect(nightly.sourceCoverage).toBe(true);
  expect(plannedCiJobs(nightly).find((row) => row.id === "source_coverage")?.priority).toBe("P2");
  expect(queue.sourceCoverage).toBe(false);
  expect(stable.sourceCoverage).toBe(false);
  const artifacts = sourceCoverageArtifacts(nightly, 2);
  expect(artifacts.some((name) => name.startsWith("windows"))).toBe(false);
  expect(artifacts.filter((name) => name.startsWith("database_tests-"))).toHaveLength(nightly.databaseMatrix.length);
  expect(sourceCoverageArtifacts(queue, 2)).toEqual([]);
});

test("shared inputs select all essential owners and prose starts no runtime suites", () => {
  const shared = resolveCiScope({ ...scopeFixture(), changedFiles: ["bun.lock"] });
  expect(shared.affectedOwners).toHaveLength(scopeFixture().packages.length);
  expect(shared.componentMatrix).toHaveLength(0);
  const docs = resolveCiScope({ ...scopeFixture(), changedFiles: ["documentation/guide.md"] });
  expect(docs.packageChecks).toBe(false);
  expect(docs.databaseMatrix).toEqual([]);
  expect(docs.componentMatrix).toEqual([]);
});

test("a newly named contract joins nightly automatically and main uses provenance plus smoke", () => {
  const input = scopeFixture();
  input.tests.push("packages/e2e/src/ui/new-contract.p1.spec.ts");
  expect(
    JSON.stringify(resolveCiScope({ ...input, event: "workflow_dispatch", profile: "production" }).appMatrix),
  ).toContain("new-contract.p1.spec.ts");
  const main = resolveCiScope({ ...input, event: "push" });
  expect(main.stage).toBe("main");
  expect(main.packageChecks).toBe(false);
  expect(main.browserSmoke).toBe(true);
  expect(main.databaseMatrix).toEqual([]);
});

test("CI tooling edits check their owner and declared consumers while the queue still checks every owner", () => {
  const input = scopeFixture();
  input.packages.push(
    { name: "pstdio-scripts", dir: "scripts", dependencies: [] },
    { name: "tooling-consumer", dir: "packages/tooling-consumer", dependencies: ["pstdio-scripts"] },
  );
  input.tests.push("scripts/ci/selection.p0.test.ts");
  const changedFiles = ["scripts/ci/selection.ts"];
  const pr = resolveCiScope({ ...input, changedFiles });
  expect(pr.affectedOwners).toEqual(["pstdio-scripts", "tooling-consumer"]);
  expect(pr.databaseMatrix).toEqual([]);
  const queue = resolveCiScope({ ...input, changedFiles, event: "merge_group" });
  expect(queue.affectedOwners).toHaveLength(input.packages.length);
  for (const file of [
    "scripts/build/compile.ts",
    "scripts/release/stage-package.ts",
    "scripts/test-setup.ts",
    "bun.lock",
    "nx.json",
  ]) {
    expect(resolveCiScope({ ...input, changedFiles: [file] }).affectedOwners).toHaveLength(input.packages.length);
  }
});

test("a queue entry runs dependency and public API checks only when its own diff touches them", () => {
  const input = scopeFixture();
  const source = resolveCiScope({ ...input, event: "merge_group" });
  expect(source).toMatchObject({ license: false, publishedExtensions: false, sdkApiReport: false });
  const ui = resolveCiScope({
    ...input,
    event: "merge_group",
    changedFiles: ["packages/ui/src/index.ts", "packages/ui/package.json"],
  });
  expect(ui).toMatchObject({ license: true, publishedExtensions: true, sdkApiReport: true });
  const nightly = resolveCiScope({ ...input, event: "workflow_dispatch", profile: "production" });
  expect(nightly).toMatchObject({ license: true, publishedExtensions: true, sdkApiReport: true });
});

test("P2 packaged CLI feature workflows run on one host per OS while P1 runs on every toolchain host", () => {
  const stable = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  const priorities = Object.fromEntries(stable.toolchainMatrix.map((row) => [row.platform_pkg, row.priorities]));
  for (const host of ["cli-linux-x64", "cli-darwin-arm64", "cli-win-x64"]) expect(priorities[host]).toBe("P0,P1,P2");
  for (const host of ["cli-linux-arm64", "cli-darwin-x64", "cli-win-arm64"]) expect(priorities[host]).toBe("P0,P1");
});

test("a signed release candidate runs the packaged desktop suite once, in signed validation", () => {
  const input = { ...scopeFixture(), event: "workflow_dispatch", profile: "production" };
  const source = resolveCiScope(input);
  expect(source.clientMatrix.every((row) => row.packaged)).toBe(true);
  const signed = resolveCiScope({ ...input, signedCandidate: true });
  expect(signed.clientMatrix.map((row) => row.target).sort()).toEqual([
    "darwin-arm64",
    "darwin-x64",
    "linux-x64",
    "win32-x64",
  ]);
  expect(signed.clientMatrix.every((row) => !row.packaged && row.shards === 1)).toBe(true);
});

test("production runs packaged CLI tests only in the toolchain job, which includes Linux x64", () => {
  const input = { ...scopeFixture(), event: "workflow_dispatch", profile: "production" };
  const production = resolveCiScope(input);
  expect(production.packagedMatrix.some((row) => row.suite === "cli")).toBe(false);
  expect(production.packagedMatrix.some((row) => row.suite === "browser")).toBe(true);
  expect(production.toolchainMatrix.map((row) => row.platform_pkg)).toContain("cli-linux-x64");
});

test("one shared build per run covers every package the Linux host jobs build", () => {
  const input = scopeFixture();
  const pr = resolveCiScope(input);
  expect(pr.sharedBuild.split(" --scope ").length).toBeGreaterThan(0);
  for (const owner of pr.affectedOwners) expect(pr.sharedBuild).toContain(`--scope ${owner}`);
  expect(plannedCiJobs(pr).map((job) => job.id)).toContain("build_host");
  const docs = resolveCiScope({ ...input, changedFiles: ["documentation/guide.md"] });
  expect(docs.sharedBuild).toBe("");
  expect(plannedCiJobs(docs).map((job) => job.id)).not.toContain("build_host");
  const main = resolveCiScope({ ...input, event: "push" });
  expect(main.sharedBuild).toBe("");
});
