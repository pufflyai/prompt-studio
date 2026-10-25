import { describe, expect, test } from "bun:test";
import { allBrowserChecks } from "./browser-checks";
import { allComponentChecks, sharedComponentEssentials } from "./component-checks";
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
  "packages/storybook-tests",
  "extensions/pstdio-planner",
  "extensions/harness-codex",
  "extensions/harness-open-code",
  "extensions/harness-claude-code",
  "services/relay",
  "services/account-manager",
  "scripts",
];
const workspacePackages = [
  "@pstdio/landing-page",
  "@pstdio/desktop",
  "@pstdio/ui",
  "@pstdio/sdk",
  "pstdio",
  "pstdio-api",
  "pstdio-dashboard",
  "@pstdio/workbench",
  "pstdio-db",
  "pstdio-logging",
  "e2e",
  "storybook-tests",
  "pstdio-planner",
  "harness-codex",
  "harness-open-code",
  "harness-claude-code",
  "pstdio-relay",
  "pstdio-account-manager",
  "pstdio-scripts",
];
const select = (
  changedFiles: string[],
  affectedPackages: string[] = [],
  event = "pull_request",
  labels: string[] = [],
) => resolveCiScope({ event, labels, changedFiles, packageDirs, affectedPackages, workspacePackages });

describe("stage selection", () => {
  test("qualification pushes keep the requested merge profile", () => {
    const result = resolveCiScope({
      event: "push",
      profile: "merge_queue",
      changedFiles: [],
      labels: [],
      packageDirs: [],
      affectedPackages: [],
      workspacePackages,
    });
    expect(result.stage).toBe("merge_queue");
    expect(result.databaseTests).toBe(true);
    expect(result.production).toBe(false);
  });
  for (const files of [["packages/sdk/src/index.ts"], ["clients/landing-page/src/index.astro"], ["README.md"]]) {
    test(`the queue certifies all Linux/macOS merge contracts for ${files[0]}`, () => {
      expect(select(files, ["pstdio-api", "e2e"], "merge_group")).toMatchObject({
        stage: "merge_queue",
        databaseTests: true,
        packageChecks: true,
        production: false,
      });
    });
  }
  test("ci:full requests separate diagnostics without replacing the fast PR gate", () => {
    expect(select(["README.md"], [], "pull_request", ["ci:full"]).stage).toBe("pull_request");
  });
  test("main uses smoke and manual production retains comprehensive coverage", () => {
    expect(select([], [], "push").stage).toBe("main");
    expect(select([], [], "workflow_dispatch").stage).toBe("full");
    expect(select([], [], "push").browserSmoke).toBe(true);
    expect(select([], [], "push").databaseTests).toBe(false);
  });
});

test("package checks explicitly name all affected consumers", () => {
  const scope = select(["packages/sdk/src/index.ts"], ["@pstdio/sdk", "pstdio-api", "pstdio-dashboard"]);
  expect(scope.lernaFilter).toBe("--scope @pstdio/sdk --scope pstdio-api --scope pstdio-dashboard");
  expect(scope.packageChecks).toBe(true);
  expect(scope.databaseTests).toBe(false);
  expect(scope.packageMatrix.flatMap((row) => row.packages).sort()).toEqual([
    "@pstdio/sdk",
    "pstdio-api",
    "pstdio-dashboard",
  ]);
  expect(scope.browserSmoke).toBe(true);
});

test("shared inputs partition all workspace owners before dependency installation", () => {
  const workspacePackages = ["pstdio-api", "@pstdio/sdk", "e2e", "storybook-tests", "pstdio-sync"];
  const scope = resolveCiScope({
    event: "pull_request",
    labels: [],
    changedFiles: ["bun.lock"],
    packageDirs,
    affectedPackages: [],
    workspacePackages,
  });
  expect(scope.packageMatrix.flatMap((row) => row.packages).sort()).toEqual(workspacePackages.sort());
  expect(scope.packageMatrix).toHaveLength(4);
});

test.each([
  "pull_request",
  "merge_group",
  "workflow_dispatch",
])("enabled package checks reject an empty workspace inventory for %s", (event) => {
  expect(() =>
    resolveCiScope({
      event,
      labels: [],
      changedFiles: ["bun.lock"],
      packageDirs: [],
      affectedPackages: [],
      workspacePackages: [],
    }),
  ).toThrow("Package checks require at least one selected workspace owner");
});

test("browser-test-only changes select browser checks without an empty unit-test scope", () => {
  const scope = select(["packages/e2e/src/ui/main-fullscreen.spec.ts"], ["e2e"]);
  expect(scope.packageChecks).toBe(false);
  expect(scope.browserSmoke).toBe(true);
  expect(scope.browserChecks.length).toBeGreaterThan(0);
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
  expect(scope.dockerBuild).toBe(false);
});

test("package prose runs documentation checks without runtime suites", () => {
  const scope = select(["extensions/harness-codex/README.md"], ["harness-codex"]);
  expect(scope.packageChecks).toBe(false);
  expect(scope.publishedExtensions).toBe(false);
  expect(scope.harnessCli).toBe(false);
  expect(scope.browserChecks).toEqual([]);
});

test("shared tooling selects all fast essentials with separate production breadth", () => {
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
      dockerBuild: false,
      relaySmoke: false,
      databaseTests: true,
      license: true,
      publishedExtensions: true,
      harnessCli: false,
      browserSmoke: true,
    });
    expect(scope.browserChecks, file).toEqual(allBrowserChecks);
    expect(scope.stage).toBe("pull_request");
  }
});

test("production certifies containers while dependency changes retain fast license checks", () => {
  for (const file of [
    ".dockerignore",
    "bunfig.toml",
    "bun.lock",
    "package.json",
    "packages/ui/package.json",
    "clients/landing-page/Dockerfile",
  ]) {
    expect(select([file], [], "workflow_dispatch").dockerBuild, file).toBe(true);
  }
  expect(select(["packages/ui/package.json"]).license).toBe(true);
  expect(select(["clients/landing-page/src/index.astro"]).dockerBuild).toBe(false);
});

test("API, database and relay consumers select isolated storage checks", () => {
  expect(select(["packages/pstdio-api/src/app.ts"], ["pstdio-api"]).databaseTests).toBe(true);
  for (const name of ["pstdio-db", "pstdio-relay", "pstdio-account-manager"]) {
    expect(select([`services/${name}/src/index.ts`], [name], "merge_group").relaySmoke).toBe(true);
  }
  expect(select(["infra/relay/compose.test.yaml"], [], "merge_group").relaySmoke).toBe(true);
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
  for (const harness of ["harness-codex", "harness-open-code", "harness-claude-code"]) {
    expect(select([`extensions/${harness}/src/detection.ts`], [], "workflow_dispatch").harnessCli).toBe(true);
  }
  expect(select(["packages/pstdio-dashboard/src/main.tsx"]).publishedExtensions).toBe(false);
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

test("component PR selection follows changed owners rather than every reverse dependency", () => {
  const manifest = select(["extensions/pstdio-planner/package.json"], ["pstdio-planner", "storybook-tests"]);
  expect(manifest.componentChecks).toBe(false);
  const global = select(["bun.lock"]);
  expect(global.componentFiles).toEqual(sharedComponentEssentials.map((file) => `src/ui/${file}`).sort());
  expect(global.componentShards).toBe(1);
  const direct = select(["packages/storybook-tests/src/ui/panel-placement.spec.ts"], ["storybook-tests"]);
  expect(direct.componentFiles).toEqual(["src/ui/panel-placement.spec.ts"]);
  expect(direct.packageChecks).toBe(true);
  for (const event of ["merge_group", "workflow_dispatch"]) {
    const complete = select(["bun.lock"], [], event);
    expect(complete.componentFiles).toEqual(allComponentChecks.map((file) => `src/ui/${file}`));
    expect(complete.componentShards).toBe(3);
  }
});
