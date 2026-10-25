import { expect, test } from "bun:test";
import { partitionFocusedFiles } from "./focused-test-files";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs, requiredCiJobs } from "./required-ci-jobs";

const workspacePackages = ["@pstdio/sdk", "@pstdio/ui", "pstdio-api", "pstdio-db", "pstdio-dashboard"];
const scope = (event: string) =>
  resolveCiScope({
    event,
    changedFiles: [],
    labels: [],
    packageDirs: [],
    affectedPackages: [],
    workspacePackages,
  });

test("the gate waits for each exact package partition as collect-all P0", () => {
  expect(plannedCiJobs(scope("merge_group")).find((job) => job.id === "package_checks")).toEqual({
    id: "package_checks",
    count: 4,
    names: ["package_checks (1/4)", "package_checks (2/4)", "package_checks (3/4)", "package_checks (4/4)"],
    priority: "P0",
  });
});

test("complete Linux/macOS merge contracts and basic artifacts remain mandatory", () => {
  const required = requiredCiJobs(scope("merge_group"));
  for (const id of [
    "scope",
    "static_checks",
    "package_checks",
    "database_tests",
    "e2e",
    "storybook_tests",
    "build_clients",
    "packaged_toolchain",
  ])
    expect(required).toContain(id);
  const clients = plannedCiJobs(scope("merge_group")).find((job) => job.id === "build_clients");
  expect(clients?.names).toEqual([
    "build_clients (linux-x64)",
    "build_clients (darwin-arm64)",
    "build_clients (darwin-x64)",
  ]);
});

test("component validation waits for every owner producer and every browser shard", () => {
  const jobs = plannedCiJobs(scope("merge_group"));
  expect(jobs.find((job) => job.id === "storybooks")).toEqual({
    id: "storybooks",
    count: 3,
    names: ["storybooks (ui)", "storybooks (pstdio-dashboard)", "storybooks (pstdio-workbench)"],
    priority: "P1",
  });
  expect(jobs.find((job) => job.id === "storybook_tests")?.count).toBe(3);
});

test("a focused component PR requires its one selected browser row", () => {
  const selected = resolveCiScope({
    event: "pull_request",
    changedFiles: ["bun.lock"],
    labels: [],
    packageDirs: [],
    affectedPackages: [],
    workspacePackages,
  });
  expect(plannedCiJobs(selected).find((job) => job.id === "storybook_tests")).toEqual({
    id: "storybook_tests",
    count: 1,
    names: ["storybook_tests (1)"],
    priority: "P1",
  });
});

test("production owns Windows and broad platform compatibility", () => {
  const required = requiredCiJobs(scope("workflow_dispatch"));
  for (const id of [
    "windows_test_and_build",
    "windows_database_tests",
    "harness_cli_support",
    "build_docker",
    "quarantined_bun_tests",
    "quarantined_browser_tests",
  ])
    expect(required).toContain(id);
  const windows = plannedCiJobs(scope("workflow_dispatch")).find((job) => job.id === "windows_database_tests");
  expect(windows?.count).toBe(12);
  expect(windows?.names).toContain("windows_database_tests (pstdio-api 8/8)");
});

test("main requires trusted provenance and smoke instead of another broad run", () => {
  expect(requiredCiJobs(scope("push"))).toEqual(["scope", "static_checks", "browser_smoke"]);
});

test("focused PR database rows name their exact selected shard identities", () => {
  const selected = resolveCiScope({
    event: "pull_request",
    changedFiles: ["packages/pstdio-api/src/app.ts"],
    labels: [],
    packageDirs: ["packages/pstdio-api"],
    affectedPackages: ["pstdio-api"],
    workspacePackages,
  });
  const database = plannedCiJobs(selected, [{ package: "pstdio-api", shard: "1/1" }]).find(
    (job) => job.id === "database_tests",
  );
  expect(database).toEqual({
    id: "database_tests",
    count: 1,
    names: ["database_tests (pstdio-api 1/1)"],
    priority: "P1",
  });
});

test.each([
  { package: "pstdio-api", files: 403, shards: 4, targetFilesPerRow: 100 },
  { package: "pstdio-db", files: 67, shards: 3, targetFilesPerRow: 25 },
])("a partitioned $package fallback requires every selected row", (selection) => {
  const selected = resolveCiScope({
    event: "pull_request",
    changedFiles: [`packages/${selection.package}/src/app.ts`],
    labels: [],
    packageDirs: [`packages/${selection.package}`],
    affectedPackages: [selection.package],
    workspacePackages,
  });
  const rows = partitionFocusedFiles(
    Array.from({ length: selection.files }, (_, index) => `${index}.test.ts`),
    selection.shards,
    selection.targetFilesPerRow,
  );
  const matrix = rows.map((files, index) => ({
    package: selection.package,
    shard: `${index + 1}/${rows.length}`,
    files: JSON.stringify(files),
  }));
  expect(plannedCiJobs(selected, matrix).find((job) => job.id === "database_tests")).toEqual({
    id: "database_tests",
    count: selection.shards,
    names: Array.from(
      { length: selection.shards },
      (_, index) => `database_tests (${selection.package} ${index + 1}/${selection.shards})`,
    ),
    priority: "P1",
  });
});
