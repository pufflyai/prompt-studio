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

const pullRequest = (changedFiles: string[], labels: string[] = [], affectedPackages: string[] = []) =>
  resolveCiScope({ event: "pull_request", labels, changedFiles, packageDirs, affectedPackages });

const full = {
  stage: "full",
  dockerBuild: true,
  relaySmoke: true,
  lernaFilter: "",
  license: true,
  publishedExtensions: true,
  harnessCli: true,
  databaseTests: true,
};

const everyLinuxCheck = { ...full, stage: "pull_request" };

const scoped = {
  stage: "pull_request",
  dockerBuild: false,
  relaySmoke: false,
  lernaFilter: "--since HEAD~1",
  license: false,
  publishedExtensions: false,
  harnessCli: false,
  databaseTests: false,
};

describe("CI stage", () => {
  test("a push to main runs the full stage", () => {
    expect(
      resolveCiScope({ event: "push", labels: [], changedFiles: ["README.md"], packageDirs, affectedPackages: [] }),
    ).toEqual(full);
  });

  test("a manual run runs the full stage", () => {
    expect(
      resolveCiScope({ event: "workflow_dispatch", labels: [], changedFiles: [], packageDirs, affectedPackages: [] }),
    ).toEqual(full);
  });

  test("the merge queue runs only its build and static check stage", () => {
    const scope = resolveCiScope({
      event: "merge_group",
      labels: [],
      changedFiles: ["packages/pstdio-api/src/app.ts", "bun.lock"],
      packageDirs,
      affectedPackages: ["pstdio-api"],
    });

    expect(scope).toEqual({
      stage: "merge_queue",
      dockerBuild: true,
      relaySmoke: true,
      lernaFilter: "",
      license: false,
      publishedExtensions: false,
      harnessCli: false,
      databaseTests: false,
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

  test("container and dependency inputs build Docker images before entering the merge queue", () => {
    for (const file of [
      ".dockerignore",
      "bunfig.toml",
      "bun.lock",
      "package.json",
      "packages/ui/package.json",
      "extensions/pstdio-planner/bun.lock",
      "clients/landing-page/Dockerfile",
      "packages/pstdio-api/Dockerfile",
    ]) {
      expect(pullRequest([file]).dockerBuild, file).toBe(true);
    }
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

test("API and database tests run in their own shards when a change affects those packages", () => {
  expect(pullRequest(["packages/pstdio-db/src/db/schema.ts"], [], ["pstdio-db", "pstdio-api"]).databaseTests).toBe(
    true,
  );
  expect(pullRequest(["packages/pstdio-api/src/app.ts"], [], ["pstdio-api"]).databaseTests).toBe(true);
  expect(pullRequest(["packages/pstdio-dashboard/src/main.tsx"], [], ["pstdio-dashboard"]).databaseTests).toBe(false);
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

test("extension docs and skill prose run the extension's own checks, not the published or installed CLI checks", () => {
  for (const file of [
    "extensions/harness-codex/README.md",
    "extensions/pstdio-planner/docs/0001-cli.md",
    "extensions/pstdio-skills/skills/create-pstdio-extension/references/scope.md",
  ]) {
    expect(pullRequest([file]), file).toEqual(scoped);
  }
  expect(
    pullRequest(["extensions/pstdio-skills/skills/create-pstdio-extension/references/examples/pigeon.ts"]),
  ).toHaveProperty("publishedExtensions", true);
});

test("installed CLI checks run for harness changes", () => {
  expect(pullRequest(["extensions/harness-codex/src/detection.ts"]).harnessCli).toBe(true);
  expect(pullRequest(["extensions/harness-claude-code/src/spawn.ts"]).harnessCli).toBe(true);
  expect(pullRequest(["extensions/harness-open-code/src/detection.ts"]).harnessCli).toBe(true);
  expect(pullRequest(["extensions/pstdio-planner/extension.ts"]).harnessCli).toBe(false);
});

test("relay changes select the isolated container check", () => {
  const scope = resolveCiScope({
    event: "pull_request",
    labels: [],
    changedFiles: ["services/relay/src/server.ts"],
    packageDirs: [...packageDirs, "services/relay"],
    affectedPackages: ["pstdio-relay"],
  });
  expect(scope.lernaFilter).toBe("--since HEAD~1");
  expect(scope).toHaveProperty("relaySmoke", true);
  expect(pullRequest(["packages/ui/src/index.ts"])).toHaveProperty("relaySmoke", false);
  expect(pullRequest(["bun.lock"])).toHaveProperty("relaySmoke", true);
});

test("relay deployment setup changes select the isolated container check", () => {
  for (const file of ["infra/relay/compose.test.yaml", "infra/relay/compose.local.yaml"]) {
    const scope = resolveCiScope({
      event: "pull_request",
      labels: [],
      changedFiles: [file],
      packageDirs: [...packageDirs, "services/relay"],
      affectedPackages: [],
    });
    expect(scope, file).toHaveProperty("relaySmoke", true);
  }
});

test("private account manager changes select the isolated infrastructure check", () => {
  const scope = resolveCiScope({
    event: "pull_request",
    labels: [],
    changedFiles: ["services/account-manager/src/authority.ts"],
    packageDirs: [...packageDirs, "services/account-manager"],
    affectedPackages: ["pstdio-account-manager"],
  });
  expect(scope.lernaFilter).toBe("--since HEAD~1");
  expect(scope.relaySmoke).toBe(true);
});

test("local storage changes select production relay conformance", () => {
  expect(
    pullRequest(["packages/pstdio-db/src/services/extension-storage/grouped-storage.ts"], [], ["pstdio-db"]),
  ).toHaveProperty("relaySmoke", true);
});
