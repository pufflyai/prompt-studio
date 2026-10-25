import { expect, test } from "bun:test";
import { scopeFixture } from "./ci-scope.test-fixture";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs } from "./required-ci-jobs";

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

test("PRs select focused P0 rules and the required queue selects every P1 owner", () => {
  const input = { ...scopeFixture(), changedFiles: ["scripts/ci/run-package-checks.ts"] };
  const pr = resolveCiScope(input);
  expect(pr.databaseMatrix.every((row) => row.priority === "P0")).toBe(true);
  expect(pr.componentMatrix).toEqual([]);
  expect(pr.appMatrix).toEqual([]);
  expect(plannedCiJobs(pr).every((job) => job.priority === "P0")).toBe(true);
  const queue = resolveCiScope({ ...input, event: "merge_group" });
  expect(queue.databaseMatrix.some((row) => row.package === "pstdio-db" && row.priority === "P1")).toBe(true);
  expect(queue.appMatrix.every((row) => row.priority === "P1")).toBe(true);
  expect(queue.appMatrix).toHaveLength(2);
  expect(queue.componentMatrix).toHaveLength(2);
});

test("the queue includes every critical contract and production adds separate breadth", () => {
  const queue = resolveCiScope({ ...scopeFixture(), event: "merge_group" });
  expect(queue.stage).toBe("merge_queue");
  expect(queue.databaseMatrix.some((row) => row.package === "pstdio-db")).toBe(true);
  expect(queue.appMatrix.every((row) => row.priority === "P1")).toBe(true);
  expect(queue.componentMatrix).toHaveLength(2);
  expect(JSON.stringify(queue)).not.toContain("feature.p2");
  const production = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  expect(production.appMatrix.some((row) => row.priority === "P2")).toBe(true);
  expect(production.packagedMatrix.some((row) => row.priority === "P2")).toBe(true);
});

test("Intel Mac validation belongs to full releases while nightly keeps Windows diagnostics", () => {
  const input = { ...scopeFixture(), event: "workflow_dispatch", profile: "production" };
  const queue = resolveCiScope({ ...input, profile: "merge_queue" });
  const nightly = resolveCiScope({ ...input, releaseChannel: "nightly" });
  const stable = resolveCiScope({ ...input, releaseChannel: "stable" });
  expect(queue.clientMatrix.map((row) => row.target)).toEqual(["linux-x64", "darwin-arm64"]);
  expect(nightly.clientMatrix.map((row) => row.target)).toEqual(["linux-x64", "darwin-arm64", "win32-x64"]);
  expect(stable.clientMatrix.map((row) => row.target)).toContain("darwin-x64");
  expect(nightly.toolchainMatrix.map((row) => row.platform_pkg)).not.toContain("cli-darwin-x64");
  expect(stable.toolchainMatrix.map((row) => row.platform_pkg)).toContain("cli-darwin-x64");
  expect(JSON.stringify(plannedCiJobs(nightly))).not.toContain("cli-darwin-x64");
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

test("a newly named contract joins the queue automatically and main uses provenance plus smoke", () => {
  const input = scopeFixture();
  input.tests.push("packages/e2e/src/ui/new-contract.p1.spec.ts");
  expect(JSON.stringify(resolveCiScope({ ...input, event: "merge_group" }).appMatrix)).toContain(
    "new-contract.p1.spec.ts",
  );
  const main = resolveCiScope({ ...input, event: "push" });
  expect(main.stage).toBe("main");
  expect(main.packageChecks).toBe(false);
  expect(main.browserSmoke).toBe(true);
  expect(main.databaseMatrix).toEqual([]);
});
