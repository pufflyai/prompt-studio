import { relative } from "node:path";
import { suites } from "./benchmark-registry";
import { partitionPackageChecks } from "./package-check-matrix";
import { productionDesktopPlatforms, productionToolchainPlatforms } from "./production-platforms";
import { priorityFromFile, testRunner } from "./test-discovery";
import { shardTestFiles } from "./test-file-shards";
import type { TestPriority } from "./test-policy";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";
import { compatibleTestTimings, type TestTimingSnapshot } from "./test-timing-snapshot";
import type { readWorkspacePackages } from "./workspace-packages";

type WorkspacePackage = ReturnType<typeof readWorkspacePackages>[number];

// Each contract job spends most of a minute on setup before short tests. Two shards keep the
// queue's job count low while the longest shard stays within its critical path.
const contractJobs = 2;

const partition = (files: string[], maximum: number, target: number, timings: Record<string, number>) => {
  const count = Math.min(maximum, Math.ceil(files.length / target));
  return Array.from(
    { length: count },
    (_, index) => shardTestFiles(files, { shard: `${index + 1}/${count}`, timings }).files,
  );
};

const fileRows = (files: string[], count: number, priority: TestPriority) =>
  Array.from({ length: Math.min(files.length, count) }, (_, index) => ({
    priority,
    shard: index + 1,
    total: Math.min(files.length, count),
    files: JSON.stringify(files.map((file) => relative("packages/e2e", file).replaceAll("\\", "/"))),
  }));

const componentRows = (files: string[], packages: WorkspacePackage[], owners: string[], priorities: TestPriority[]) => {
  const sourceOwners = packages.filter(
    (pkg) =>
      owners.includes(pkg.name) &&
      files.some((file) => file.startsWith(`packages/canvas-tests/src/ui/${pkg.dir.split("/").at(-1)}/`)),
  );
  const selected = files.filter((file) => {
    if (testRunner(file) !== "component") return false;
    const owner = file.split("/")[4];
    if (sourceOwners.length) return sourceOwners.some((pkg) => pkg.dir === `packages/${owner}`);
    return owners.includes("canvas-tests");
  });
  return priorities.flatMap((priority) => {
    const matching = selected.filter((file) => priorityFromFile(file) === priority);
    return [...new Set(matching.map((file) => file.split("/")[4]!))].sort().map((owner) => ({
      package: owner,
      project: packages.find((pkg) => pkg.dir === `packages/${owner}`)!.name,
      priority,
      files: JSON.stringify(
        matching
          .filter((file) => file.split("/")[4] === owner)
          .map((file) => file.replace("packages/canvas-tests/", "")),
      ),
    }));
  });
};

export const selectCiTests = (
  files: string[],
  packages: WorkspacePackage[],
  owners: string[],
  priorities: TestPriority[],
  timingSnapshot?: TestTimingSnapshot,
  coverage = false,
) => {
  const functional = priorities.filter((priority) => priority !== "P0");
  const selected = files.filter((file) => {
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`));
    return owner && owners.includes(owner.name);
  });
  const databaseMatrix = priorities.flatMap((priority) =>
    packages
      .filter((pkg) => ["pstdio-api", "pstdio-db"].includes(pkg.name))
      .flatMap((pkg) => {
        const matching = selected.filter(
          (file) => file.startsWith(`${pkg.dir}/`) && file.endsWith(".test.ts") && priorityFromFile(file) === priority,
        );
        const api = pkg.name === "pstdio-api";
        let maximum = 3;
        let target = 25;
        if (api) {
          maximum = 4;
          target = 100;
        }
        if (api && priority === "P1") {
          maximum = 5;
          target = 50;
        }
        const timings = compatibleTestTimings(timingSnapshot, {
          kind: "file",
          profile: `${pkg.name}/${api ? "api" : "bun"}`,
          host: "linux/x64",
          configuration: `source:stable:${priority}`,
          coverage,
        });
        const rows = partition(matching, maximum, target, timings);
        return rows.map((row, index) => ({
          package: pkg.name,
          priority,
          shard: `${index + 1}/${rows.length}`,
          files: JSON.stringify(row.map((file) => file.slice(pkg.dir.length + 1))),
        }));
      }),
  );
  const bunContractMatrix = functional.flatMap((priority) => {
    const names = packages
      .filter(
        (pkg) =>
          !["pstdio-api", "pstdio-db"].includes(pkg.name) &&
          selected.some(
            (file) =>
              file.startsWith(`${pkg.dir}/`) && testRunner(file) === "bun" && priorityFromFile(file) === priority,
          ),
      )
      .map((pkg) => pkg.name);
    return partitionPackageChecks(
      names,
      contractJobs,
      compatibleTestTimings(timingSnapshot, {
        kind: "package",
        profile: "contracts",
        host: "linux/x64",
        configuration: `source:stable:${priority}`,
        coverage,
      }),
    ).map((row) => ({ ...row, priority }));
  });
  const app = selected.filter((file) => testRunner(file) === "app");
  const appMatrix = functional.flatMap((priority) =>
    fileRows(
      app.filter((file) => priorityFromFile(file) === priority),
      priority === "P1" ? 2 : 12,
      priority,
    ),
  );
  const packagedMatrix = functional.flatMap((priority) =>
    ["packaged-cli", "packaged-browser", "vite"].flatMap((runner) => {
      const matching = selected.filter((file) => testRunner(file) === runner && priorityFromFile(file) === priority);
      let shards = 1;
      if (priority === "P2" && runner === "packaged-cli") shards = 2;
      if (priority === "P2" && runner === "packaged-browser") shards = 3;
      const suite = runner.replace("packaged-", "");
      return fileRows(matching, shards, priority).map((row) => ({ ...row, suite, shard: `${row.shard}/${row.total}` }));
    }),
  );
  return {
    integrationMatrix: priorities.flatMap((priority) =>
      partitionPackageChecks(
        packages
          .filter((pkg) =>
            selected.some(
              (file) =>
                file.startsWith(`${pkg.dir}/`) &&
                testRunner(file) === "integration" &&
                priorityFromFile(file) === priority,
            ),
          )
          .map((pkg) => pkg.name),
        contractJobs,
      ).map((row) => ({ ...row, priority })),
    ),
    databaseMatrix,
    bunContractMatrix,
    appMatrix,
    packagedMatrix,
    componentMatrix: componentRows(files, packages, owners, functional),
  };
};

type Packages = ReturnType<typeof readWorkspacePackages>;
const linux = { os: "ubuntu-24.04", platform: "linux", arch: "x64" };

export const selectEditedTests = (files: string[], packages: Packages) => {
  const groups = new Map<
    string,
    { owner: string; runner: string; priority: string; subgroup: string; files: string[] }
  >();
  const performance = new Map<string, string[]>();
  for (const file of files) {
    const priority = priorityFromFile(file)!;
    const runner = testRunner(file);
    if (runner === "performance") {
      const suite = suites.find((suite) => suite.files.includes(file));
      if (!suite) throw new Error(`Edited benchmark has no registered suite: ${file}`);
      performance.set(suite.id, [...(performance.get(suite.id) ?? []), file]);
      continue;
    }
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`))?.name ?? "repository";
    const subgroup = runner === "desktop" && file.includes("/packaged-") ? "packaged" : "source";
    const key = `${owner}:${runner}:${priority}:${subgroup}`;
    const group = groups.get(key) ?? { owner, runner, priority, subgroup, files: [] };
    group.files.push(file);
    groups.set(key, group);
  }
  // PR checks guard the nightly, so edited tests run on the nightly's hosts.
  const rows = [...groups.values()].flatMap((group) => {
    let platforms = [linux];
    if (group.runner === "desktop" || group.owner === "@pstdio/desktop")
      platforms = productionDesktopPlatforms("nightly");
    if (group.runner === "packaged-cli")
      platforms = productionToolchainPlatforms("nightly")
        .filter((row) => row.shard === 1 && row.priorities.split(",").includes(group.priority))
        .map((row) => {
          const [, platform, arch] = row.platform_pkg.split("-");
          return { os: row.os, platform: platform!, arch: arch! };
        });
    return platforms.flatMap((platform) => {
      const covered =
        group.priority === "P0" &&
        platform.platform === "linux" &&
        ["bun", "api", "integration"].includes(group.runner) &&
        group.owner !== "repository";
      const quarantined = new Set(
        quarantineRegistry
          .filter(
            (entry) =>
              entry.runner === quarantineRunnerForTest(group.runner) &&
              matchesPlatform(entry, platform.platform, platform.arch),
          )
          .map((entry) => entry.file),
      );
      const selected = covered ? group.files.filter((file) => quarantined.has(file)) : group.files;
      return Array.from({ length: Math.ceil(selected.length / 8) }, (_, index) => {
        const files = selected.slice(index * 8, (index + 1) * 8);
        return {
          name: `${group.owner} ${group.runner} ${group.subgroup} ${group.priority} ${index + 1} ${platform.os}`,
          ...platform,
          owner: group.owner,
          runner: group.runner,
          priority: group.priority,
          files: JSON.stringify(files),
          stable: !covered,
          quarantine: files.some((file) => quarantined.has(file)),
          suite: "",
          // Desktop checks drive Electron, never a Playwright browser.
          browser: !["bun", "api", "integration", "desktop"].includes(group.runner),
          desktop: group.runner === "desktop",
          // The Playwright image ships browsers and their libraries, so Linux rows download no Ubuntu
          // packages. Rows stay on the native host their nightly suite uses: desktop configures
          // Electron's sandbox with sudo, and the packaged CLI suite runs on native toolchain hosts.
          container:
            platform.platform === "linux" &&
            !["bun", "api", "integration", "desktop", "packaged-cli"].includes(group.runner),
        };
      });
    });
  });
  for (const [id, files] of performance) {
    let platforms = [linux];
    if (["desktop", "runtime", "storage"].includes(id)) platforms = productionDesktopPlatforms("nightly");
    for (const platform of platforms)
      rows.push({
        name: `${id} P3 ${platform.os}`,
        ...platform,
        owner: "",
        runner: "performance",
        priority: "P3",
        files: JSON.stringify(files),
        stable: true,
        quarantine: quarantineRegistry.some(
          (entry) => files.includes(entry.file) && matchesPlatform(entry, platform.platform, platform.arch),
        ),
        suite: id,
        browser: ["desktop", "workbench", "canvas", "chat", "subnav", "planner"].includes(id),
        desktop: false,
        // Benchmarks keep the native hosts their budgets were measured on.
        container: false,
      });
  }
  if (rows.length > 256) throw new Error("Edited tests exceed the matrix limit; split this PR");
  return rows;
};

// The original root/package default excludes separately scheduled integration, packaged and desktop journeys.
// An explicit priority or file request can select those families without broadening the default command.
export const selectLocalTests = (files: string[], explicit: boolean) =>
  explicit
    ? files
    : files.filter((file) => {
        const runner = testRunner(file);
        return (
          !["integration", "packaged-cli", "packaged-browser", "desktop", "performance", "browser-helper"].includes(
            runner,
          ) &&
          !file.startsWith("packages/e2e/src/packaged/") &&
          !file.startsWith("clients/desktop/src/e2e/")
        );
      });
