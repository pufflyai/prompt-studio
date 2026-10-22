import { describe, expect, test } from "bun:test";
import { allBrowserChecks } from "./browser-checks";
import { resolveCiScope } from "./pull-request-ci-scope";

const packageDirs = [
  "clients/landing-page",
  "clients/desktop",
  "packages/ui",
  "packages/sdk",
  "packages/pstdio",
  "packages/pstdio-api",
  "packages/pstdio-dashboard",
  "packages/pstdio-workbench",
  "packages/pstdio-db",
  "packages/pstdio-logging",
  "packages/e2e",
  "extensions/pstdio-planner",
  "extensions/harness-codex",
  "extensions/harness-open-code",
  "extensions/harness-claude-code",
  "extensions/harness-pi",
  "services/relay",
  "services/account-manager",
  "scripts",
];
const select = (
  changedFiles: string[],
  affectedPackages: string[] = [],
  event = "pull_request",
  labels: string[] = [],
) => resolveCiScope({ event, labels, changedFiles, packageDirs, affectedPackages });

describe("shared PR and queue selection", () => {
  for (const files of [
    ["packages/sdk/src/index.ts"],
    ["packages/pstdio-api/src/app.ts"],
    ["clients/landing-page/src/index.astro"],
    ["bun.lock"],
    ["README.md"],
  ]) {
    test(`queue coverage equals PR coverage for ${files[0]}`, () => {
      expect(select(files, ["pstdio-api", "e2e"], "merge_group")).toEqual({
        ...select(files, ["pstdio-api", "e2e"]),
        stage: "merge_queue",
      });
    });
  }
  for (const event of ["pull_request", "merge_group"]) {
    test(`ci:full preserves all checks on ${event}`, () => {
      expect(select(["README.md"], [], event, ["ci:full"])).toEqual(select([], [], "push"));
    });
  }
  test("pushes and manual runs retain the full stage", () => {
    expect(select([], [], "push").stage).toBe("full");
    expect(select([], [], "workflow_dispatch").stage).toBe("full");
  });
});

test("package checks explicitly name all affected consumers", () => {
  const scope = select(["packages/sdk/src/index.ts"], ["@pstdio/sdk", "pstdio-api", "pstdio-dashboard"]);
  expect(scope.lernaFilter).toBe("--scope @pstdio/sdk --scope pstdio-api --scope pstdio-dashboard");
  expect(scope.packageChecks).toBe(true);
  expect(scope.databaseTests).toBe(true);
  expect(scope.browserSmoke).toBe(true);
});

test("browser-test-only changes select browser checks without an empty unit-test scope", () => {
  for (const event of ["pull_request", "merge_group"]) {
    const scope = select(["packages/e2e/src/ui/main-fullscreen.spec.ts"], ["e2e"], event);
    expect(scope.packageChecks).toBe(false);
    expect(scope.browserSmoke).toBe(true);
    expect(scope.browserChecks.length).toBeGreaterThan(0);
  }
});

test("documentation outside packages selects only static checks", () => {
  const scope = select([
    "README.md",
    "documentation/guides/development/0002-testing.md",
    "design/website.pen",
    "LICENSE",
  ]);
  expect(scope.packageChecks).toBe(false);
  expect(scope.browserSmoke).toBe(false);
  expect(scope.browserChecks).toEqual([]);
  expect(scope.nativeChecks).toEqual([]);
  expect(scope.dockerBuild).toBe(false);
});

test("package prose keeps package checks without adding runtime checks", () => {
  const scope = select(["extensions/harness-codex/README.md"], ["harness-codex"]);
  expect(scope.packageChecks).toBe(true);
  expect(scope.publishedExtensions).toBe(false);
  expect(scope.harnessCli).toBe(false);
  expect(scope.browserChecks).toEqual([]);
  expect(scope.nativeChecks).toEqual([]);
});

test("shared tooling and unknown root inputs select every scoped check", () => {
  for (const file of [
    "bun.lock",
    ".github/workflows/test-and-build.yml",
    "tsconfig.base.json",
    "scripts/test-setup.ts",
    ".npmrc",
  ]) {
    const scope = select([file]);
    expect(scope, file).toMatchObject({
      packageChecks: true,
      dockerBuild: true,
      relaySmoke: true,
      databaseTests: true,
      license: true,
      publishedExtensions: true,
      harnessCli: true,
      browserSmoke: true,
    });
    expect(scope.browserChecks, file).toEqual(allBrowserChecks);
    expect(scope.nativeChecks, file).toEqual(["filesystem", "process", "desktop"]);
    expect(scope.stage).toBe("pull_request");
  }
});

test("Docker and dependency inputs select container and license checks", () => {
  for (const file of [
    ".dockerignore",
    "bunfig.toml",
    "bun.lock",
    "package.json",
    "packages/ui/package.json",
    "clients/landing-page/Dockerfile",
  ]) {
    expect(select([file]).dockerBuild, file).toBe(true);
  }
  expect(select(["packages/ui/package.json"]).license).toBe(true);
  expect(select(["clients/landing-page/src/index.astro"]).dockerBuild).toBe(false);
});

test("API, database and relay consumers select isolated storage checks", () => {
  expect(select(["packages/pstdio-api/src/app.ts"], ["pstdio-api"]).databaseTests).toBe(true);
  for (const name of ["pstdio-db", "pstdio-relay", "pstdio-account-manager"]) {
    expect(select([`services/${name}/src/index.ts`], [name]).relaySmoke).toBe(true);
  }
  expect(select(["infra/relay/compose.test.yaml"]).relaySmoke).toBe(true);
  expect(select(["packages/ui/src/index.ts"], ["@pstdio/ui"]).databaseTests).toBe(false);
});

test("published extension contracts and harness implementations select compatibility checks", () => {
  for (const file of [
    "extensions/pstdio-planner/extension.ts",
    "packages/sdk/src/index.ts",
    "packages/ui/src/index.ts",
    "packages/pstdio-api-contracts/src/index.ts",
  ]) {
    expect(select([file]).publishedExtensions, file).toBe(true);
  }
  for (const harness of ["harness-codex", "harness-open-code", "harness-claude-code", "harness-pi"]) {
    expect(select([`extensions/${harness}/src/detection.ts`]).harnessCli).toBe(true);
  }
  expect(select(["packages/pstdio-dashboard/src/main.tsx"]).publishedExtensions).toBe(false);
});

test("Windows checks follow native process, storage and desktop inputs", () => {
  expect(select(["extensions/harness-codex/src/spawn.ts"]).nativeChecks).toEqual(["process"]);
  expect(select(["packages/pstdio-db/src/index.ts"]).nativeChecks).toEqual(["filesystem"]);
  expect(select(["clients/desktop/src/cli/windows-path.ts"]).nativeChecks).toEqual(["desktop"]);
  expect(select(["packages/sdk/src/index.ts"]).nativeChecks).toEqual(["filesystem", "process"]);
  expect(select(["clients/landing-page/src/index.astro"]).nativeChecks).toEqual([]);
});

test("backend and shared browser dependencies select smoke and feature regressions", () => {
  for (const file of [
    "packages/pstdio-dashboard/src/main.tsx",
    "packages/pstdio-workbench/src/core/panels.ts",
    "packages/ui/src/index.ts",
    "packages/sdk/src/index.ts",
    "packages/pstdio-api/src/app.ts",
  ]) {
    expect(select([file], ["e2e"]), file).toMatchObject({ browserSmoke: true });
    expect(select([file], ["e2e"]).browserChecks.length, file).toBeGreaterThan(0);
  }
  expect(select(["clients/landing-page/src/index.astro"]).browserSmoke).toBe(false);
});
