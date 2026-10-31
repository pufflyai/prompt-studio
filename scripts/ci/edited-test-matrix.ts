import { readFileSync } from "node:fs";

import { productionDesktopPlatforms, productionToolchainPlatforms } from "./production-platforms";
import { priorityFromFile, testRunner } from "./test-discovery";
import { matchesPlatform, quarantineRegistry, quarantineRunnerForTest } from "./test-quarantine";
import type { readWorkspacePackages } from "./workspace-packages";

// Scope runs before dependency installation. Read the workspace public metadata export.
const manifestPath = new URL("../../packages/benchmarks/package.json", import.meta.url);
const benchmarkManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const suiteFiles = JSON.parse(
  readFileSync(new URL(benchmarkManifest.exports["./suite-files"], manifestPath), "utf8"),
) as Record<string, string[]>;

type Packages = ReturnType<typeof readWorkspacePackages>;
const linux = { os: "ubuntu-24.04", platform: "linux", arch: "x64" };
const supportsTests = (file: string, dir: string) =>
  ["packages/e2e", "packages/canvas-tests"].includes(dir) ||
  /(?:^|\/)(?:testing|test-utils|__fixtures__)\//.test(file) ||
  /\.(?:test-)?fixture\.tsx?$/.test(file) ||
  /^clients\/desktop\/playwright.*\.config\.ts$/.test(file);

export const editedTestFiles = (tests: string[], changed: string[], packages: Packages) => {
  const available = new Set(tests);
  const supports = packages.filter((pkg) =>
    changed.some((file) => file.startsWith(`${pkg.dir}/`) && !available.has(file) && supportsTests(file, pkg.dir)),
  );
  return [...new Set(tests)]
    .filter((file) => changed.includes(file) || supports.some((pkg) => file.startsWith(`${pkg.dir}/`)))
    .sort();
};

export const createEditedTestMatrix = (files: string[], packages: Packages) => {
  const groups = new Map<
    string,
    { owner: string; runner: string; priority: string; subgroup: string; files: string[] }
  >();
  const performance = new Map<string, string[]>();
  for (const file of files) {
    const priority = priorityFromFile(file)!;
    const runner = testRunner(file);
    if (runner === "performance") {
      const suite = Object.entries(suiteFiles).find(([, files]) => files.includes(file));
      if (!suite) throw new Error(`Edited benchmark has no registered suite: ${file}`);
      performance.set(suite[0], [...(performance.get(suite[0]) ?? []), file]);
      continue;
    }
    const owner = packages.find((pkg) => file.startsWith(`${pkg.dir}/`))?.name ?? "repository";
    const subgroup = runner === "desktop" && file.includes("/packaged-") ? "packaged" : "source";
    const key = `${owner}:${runner}:${priority}:${subgroup}`;
    const group = groups.get(key) ?? { owner, runner, priority, subgroup, files: [] };
    group.files.push(file);
    groups.set(key, group);
  }
  const rows = [...groups.values()].flatMap((group) => {
    let platforms = [linux];
    if (group.runner === "desktop" || group.owner === "@pstdio/desktop")
      platforms = productionDesktopPlatforms("stable");
    if (group.runner.startsWith("packaged-"))
      platforms = productionToolchainPlatforms("stable")
        .filter((row) => row.shard === 1)
        .map((row) => {
          const [, platform, arch] = row.platform_pkg.split("-");
          return { os: row.os, platform: platform === "win" ? "win32" : platform!, arch: arch! };
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
          browser: !["bun", "api", "integration", "cli"].includes(group.runner),
          desktop: group.runner === "desktop",
        };
      });
    });
  });
  for (const [id, files] of performance) {
    const platforms = id === "desktop" ? [{ os: "macos-15", platform: "darwin", arch: "arm64" }] : [linux];
    if (id === "runtime") platforms.push({ os: "macos-15", platform: "darwin", arch: "arm64" });
    for (const platform of platforms)
      rows.push({
        name: `${id} P3 ${platform.os}`,
        ...platform,
        owner: "",
        runner: "performance",
        priority: "P3",
        files: JSON.stringify(files),
        stable: true,
        quarantine: false,
        suite: id,
        browser: true,
        desktop: false,
      });
  }
  if (rows.length > 256) throw new Error("Edited tests exceed the matrix limit; split this PR");
  return rows;
};
