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
  "design/motion",
  "scripts",
];

const pullRequest = (changedFiles: string[], affectedPackages: string[] = []) =>
  resolveCiScope({ event: "pull_request", changedFiles, packageDirs, affectedPackages });

const everything = { lernaFilter: "", windows: true, e2e: true, license: true, publishedExtensions: true };

describe("pull request CI scope", () => {
  test("a push to main runs every job on every package", () => {
    const scope = resolveCiScope({
      event: "push",
      changedFiles: ["README.md"],
      packageDirs,
      affectedPackages: [],
    });

    expect(scope).toEqual(everything);
  });

  test("a package change tests changed packages and skips unrelated heavy jobs", () => {
    const scope = pullRequest(["clients/landing-page/src/pages/index.astro"], ["@pstdio/landing-page"]);

    expect(scope).toEqual({
      lernaFilter: "--since HEAD~1",
      windows: false,
      e2e: false,
      license: false,
      publishedExtensions: false,
    });
  });

  test("a change in a filesystem or process package runs Windows", () => {
    expect(pullRequest(["packages/pstdio-db/src/db/connection.ts"], ["pstdio-db"]).windows).toBe(true);
    expect(pullRequest(["packages/pstdio/src/cli.ts"], ["pstdio"]).windows).toBe(true);
  });

  test("a change to a dependency of a filesystem or process package runs Windows", () => {
    expect(pullRequest(["packages/pstdio-logging/src/index.ts"], ["pstdio-logging", "pstdio-api"]).windows).toBe(true);
  });

  test("an agent command runner change requires Windows checks", () => {
    const scope = pullRequest(["packages/pstdio-api/src/features/extensions/process-command.ts"], ["pstdio-api"]);

    expect(scope.lernaFilter).toBe("--since HEAD~1");
    expect(scope.windows).toBe(true);
  });

  test("a change that affects the e2e package runs the e2e jobs", () => {
    expect(pullRequest(["extensions/pstdio-planner/src/index.ts"], ["pstdio-planner", "e2e"]).e2e).toBe(true);
  });

  test("a manifest change runs the license check", () => {
    expect(pullRequest(["packages/ui/package.json"], ["@pstdio/ui"]).license).toBe(true);
  });

  test("documentation outside packages runs no heavy jobs", () => {
    const scope = pullRequest([
      "README.md",
      "documentation/guides/development/0002-testing.md",
      "design/website.pen",
      "LICENSE",
    ]);

    expect(scope).toEqual({
      lernaFilter: "--since HEAD~1",
      windows: false,
      e2e: false,
      license: false,
      publishedExtensions: false,
    });
  });

  test("any other change outside packages runs everything", () => {
    expect(pullRequest(["bun.lock"])).toEqual(everything);
    expect(pullRequest([".github/workflows/test-and-build.yml"])).toEqual(everything);
    expect(pullRequest(["tsconfig.base.json"])).toEqual(everything);
  });

  test("a repository tooling change runs everything", () => {
    expect(pullRequest(["scripts/test-setup.ts"], ["pstdio-scripts"])).toEqual(everything);
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
