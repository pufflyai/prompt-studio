import { describe, expect, test } from "bun:test";
import { resolveCiScope } from "./pull-request-ci-scope";

const packageDirs = [
  "clients/landing-page",
  "packages/ui",
  "packages/pstdio",
  "packages/pstdio-api",
  "packages/pstdio-dashboard",
  "packages/pstdio-db",
  "packages/pstdio-logging",
  "packages/e2e",
  "extensions/pstdio-planner",
  "extensions/harness-codex",
  "extensions/harness-open-code",
  "extensions/harness-claude-code",
  "design/motion",
  "scripts",
];

const pullRequest = (changedFiles: string[], labels: string[] = []) =>
  resolveCiScope({ event: "pull_request", labels, changedFiles, packageDirs });

const full = { stage: "full", lernaFilter: "", license: true, publishedExtensions: true, harnessCli: true };

const everyLinuxCheck = { ...full, stage: "pull_request" };

const scoped = {
  stage: "pull_request",
  lernaFilter: "--since HEAD~1",
  license: false,
  publishedExtensions: false,
  harnessCli: false,
};

describe("CI stage", () => {
  test("a push to main runs the full stage", () => {
    expect(resolveCiScope({ event: "push", labels: [], changedFiles: ["README.md"], packageDirs })).toEqual(full);
  });

  test("a manual run runs the full stage", () => {
    expect(resolveCiScope({ event: "workflow_dispatch", labels: [], changedFiles: [], packageDirs })).toEqual(full);
  });

  test("the merge queue runs only its build and static check stage", () => {
    const scope = resolveCiScope({
      event: "merge_group",
      labels: [],
      changedFiles: ["packages/pstdio-api/src/app.ts", "bun.lock"],
      packageDirs,
    });

    expect(scope).toEqual({
      stage: "merge_queue",
      lernaFilter: "",
      license: false,
      publishedExtensions: false,
      harnessCli: false,
    });
  });

  test("the ci:full label runs the full stage on a pull request", () => {
    expect(pullRequest(["packages/ui/src/index.ts"], ["ci:full"])).toEqual(full);
  });

  test("other labels keep the scoped pull request stage", () => {
    expect(pullRequest(["clients/landing-page/src/pages/index.astro"], ["release", "breaking-change"])).toEqual(scoped);
  });
});

describe("pull request CI scope", () => {
  test("a package change tests changed packages and skips unrelated jobs", () => {
    expect(pullRequest(["clients/landing-page/src/pages/index.astro"])).toEqual(scoped);
  });

  test("a manifest change runs the license check", () => {
    expect(pullRequest(["packages/ui/package.json"]).license).toBe(true);
  });

  test("documentation outside packages runs no extra jobs", () => {
    const scope = pullRequest([
      "README.md",
      "documentation/guides/development/0002-testing.md",
      "design/website.pen",
      "LICENSE",
    ]);

    expect(scope).toEqual(scoped);
  });

  test("any other change outside packages runs every Linux check on every package", () => {
    expect(pullRequest(["bun.lock"])).toEqual(everyLinuxCheck);
    expect(pullRequest([".github/workflows/test-and-build.yml"])).toEqual(everyLinuxCheck);
    expect(pullRequest(["tsconfig.base.json"])).toEqual(everyLinuxCheck);
  });

  test("a repository tooling change runs every Linux check on every package", () => {
    expect(pullRequest(["scripts/test-setup.ts"])).toEqual(everyLinuxCheck);
  });
});

test("published extensions are checked for extension and public contract changes", () => {
  for (const file of [
    "extensions/pstdio-planner/extension.ts",
    "packages/sdk/src/index.ts",
    "packages/ui/src/index.ts",
    "packages/pstdio-api-contracts/src/index.ts",
  ]) {
    expect(pullRequest([file]).publishedExtensions).toBe(true);
  }
  expect(pullRequest(["packages/pstdio-dashboard/src/main.tsx"]).publishedExtensions).toBe(false);
});

test("installed CLI checks run for harness changes", () => {
  expect(pullRequest(["extensions/harness-codex/src/detection.ts"]).harnessCli).toBe(true);
  expect(pullRequest(["extensions/harness-claude-code/src/spawn.ts"]).harnessCli).toBe(true);
  expect(pullRequest(["extensions/harness-open-code/src/detection.ts"]).harnessCli).toBe(true);
  expect(pullRequest(["extensions/pstdio-planner/extension.ts"]).harnessCli).toBe(false);
});
