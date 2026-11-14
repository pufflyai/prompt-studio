import { integrationCoverage, selectIntegrationFiles } from "./coverage-ownership";
import type { resolveCiScope } from "./pull-request-ci-scope";
import { priorityFromFile, testRunner } from "./test-discovery";
import type { PlanInput } from "./test-plan";
import { matchesPlatform, quarantineRegistry } from "./test-quarantine";

type Scope = ReturnType<typeof resolveCiScope>;
export type CiPlanRequest = { job: string; files: string[]; extra?: Partial<PlanInput> };
const host = (os: string) => {
  if (os.startsWith("macos")) return { platform: "darwin", arch: os.includes("intel") ? "x64" : "arm64" };
  if (os.startsWith("windows")) return { platform: "win32", arch: "x64" };
  return { platform: "linux", arch: "x64" };
};
const quarantineFiles = (runner: string, target: { platform: string; arch: string }) => [
  ...new Set(
    quarantineRegistry
      .filter((entry) => entry.runner === runner && matchesPlatform(entry, target.platform, target.arch))
      .map((entry) => entry.file),
  ),
];
const desktopRequests = (scope: Scope, tests: string[]) => {
  const requests: CiPlanRequest[] = [];
  const functional = tests.filter((file) => priorityFromFile(file) !== "P3");
  for (const row of scope.clientMatrix) {
    const target = { platform: row.platform, arch: row.arch };
    if (row.platform === "darwin" && row.shard === 1)
      requests.push({
        job: `dmg-${row.target}`,
        files: functional.filter(
          (file) =>
            file.startsWith("clients/desktop/") && testRunner(file) === "bun" && priorityFromFile(file) === "P1",
        ),
        extra: { target },
      });
    if (
      row.platform === "darwin" &&
      row.shard === 1 &&
      !scope.quarantineBunOs.some((os) => host(os).platform === target.platform && host(os).arch === target.arch)
    )
      requests.push({
        job: `dmg-${row.target}`,
        files: quarantineFiles("bun", target).filter((file) => file.startsWith("clients/desktop/")),
        extra: { target, lane: "quarantine" },
      });
    if (row.tests && row.shard === 1)
      requests.push({
        job: `electron-${row.target}`,
        files: selectIntegrationFiles(
          functional.filter((file) => testRunner(file) === "desktop" && !file.includes("/packaged-")),
          target,
        ),
        extra: { target },
      });
    if (row.packaged) {
      requests.push({
        job: `desktop-${row.target}-${row.shard}/${row.shards}`,
        files: selectIntegrationFiles(
          functional.filter((file) => testRunner(file) === "desktop" && file.includes("/packaged-")),
          target,
          scope.production ? undefined : { changed: scope.changedFiles, owners: scope.integrationOwners },
        ),
        extra: { target, shard: `${row.shard}/${row.shards}` },
      });
      if (row.shard === 1)
        requests.push({
          job: `desktop-quarantine-${row.target}`,
          files: quarantineFiles("packaged-desktop", target),
          extra: { target, lane: "quarantine" },
        });
    }
  }
  return requests.map((request) => ({ ...request, files: request.files.filter((file) => tests.includes(file)) }));
};
export const nativeCiRequests = (scope: Scope, tests: string[]) => {
  const functional = tests.filter((file) => priorityFromFile(file) !== "P3");
  const requests = desktopRequests(scope, tests);
  if (!scope.production) return requests;
  for (const os of scope.quarantineBunOs) {
    const target = host(os);
    // Dedicated DMG checks and ordinary Bun quarantines share one owner per platform.
    requests.push({
      job: `quarantine-bun-${os}`,
      files: quarantineFiles("bun", target),
      extra: { target, lane: "quarantine" },
    });
  }
  if (!scope.windowsOnly && scope.quarantineBunOs.length) {
    for (const [job, target, runner] of [
      ["quarantine-ui-native", { platform: "darwin", arch: "arm64" }, "playwright-ui"],
      ["quarantine-browser", { platform: "linux", arch: "x64" }, "playwright-ui"],
      ["quarantine-browser", { platform: "linux", arch: "x64" }, "playwright"],
    ] as const)
      requests.push({ job, files: quarantineFiles(runner, target), extra: { target, lane: "quarantine" } });
  }
  for (const row of scope.toolchainMatrix) {
    const [, platform, arch] = row.platform_pkg.split("-");
    const target = { platform: platform === "win" ? "win32" : platform!, arch: arch! };
    requests.push({
      job: `toolchain-${row.platform_pkg}-${row.shard}/${row.shards}`,
      files: selectIntegrationFiles(
        functional.filter(
          (file) =>
            file.startsWith("packages/e2e/src/packaged/") &&
            /\.test\.tsx?$/.test(file) &&
            (integrationCoverage(file).surface === "cli-artifact" ||
              (target.platform !== "linux" && integrationCoverage(file).surface === "native-runtime")),
        ),
        target,
      ),
      extra: { target, shard: `${row.shard}/${row.shards}`, artifact: "compiled-cli" },
    });
    if (row.shard === 1)
      requests.push({
        job: `toolchain-${row.platform_pkg}-${row.shard}/${row.shards}`,
        files: quarantineFiles("packaged-bun", target),
        extra: { target, lane: "quarantine" },
      });
  }
  return requests.map((request) => ({ ...request, files: request.files.filter((file) => tests.includes(file)) }));
};
