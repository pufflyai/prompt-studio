import { appendFileSync } from "node:fs";

// The nightly validates Linux and Apple Silicon. Stable releases also validate every other published host.
const nightlyHost = (host: string) => /linux|darwin-arm64|ubuntu|macos-15$/.test(host);
const forChannel = <Row>(channel: string, rows: Row[], host: (row: Row) => string) =>
  rows.filter((row) => channel !== "nightly" || nightlyHost(host(row)));

export const productionDesktopPlatforms = (channel: string) =>
  forChannel(
    channel,
    [
      { target: "linux-x64", os: "ubuntu-24.04", platform: "linux", arch: "x64" },
      { target: "darwin-arm64", os: "macos-15", platform: "darwin", arch: "arm64" },
      { target: "darwin-x64", os: "macos-15-intel", platform: "darwin", arch: "x64" },
      { target: "win32-x64", os: "windows-2025", platform: "win32", arch: "x64" },
    ],
    (row) => row.target,
  );

export const publishedDesktopTargets = (channel: string) =>
  productionDesktopPlatforms(channel).map((row) => row.target);

export const productionDesktopCheckPlatforms = (channel: string) =>
  productionDesktopPlatforms(channel).flatMap((row) => {
    const shards = row.target === "darwin-x64" ? 2 : 1;
    return Array.from({ length: shards }, (_, index) => ({ ...row, shard: index + 1, shards }));
  });

// P2 packaged CLI files test OS-independent feature workflows, so one host per OS runs them.
// Install, native process and asset checks are P1 and run on every host.
const featureHosts = new Set(["cli-linux-x64", "cli-darwin-arm64", "cli-win-x64"]);

export const productionToolchainPlatforms = (channel: string) =>
  forChannel(
    channel,
    [
      { os: "ubuntu-24.04", platform_pkg: "cli-linux-x64" },
      { os: "ubuntu-24.04-arm", platform_pkg: "cli-linux-arm64" },
      { os: "macos-15", platform_pkg: "cli-darwin-arm64" },
      { os: "macos-15-intel", platform_pkg: "cli-darwin-x64" },
      { os: "windows-latest", platform_pkg: "cli-win-x64" },
      { os: "windows-11-arm", platform_pkg: "cli-win-arm64" },
    ],
    (row) => row.platform_pkg,
  ).flatMap((row) => {
    const shards = row.platform_pkg === "cli-win-arm64" || row.platform_pkg === "cli-darwin-x64" ? 2 : 1;
    const priorities = featureHosts.has(row.platform_pkg) ? "P0,P1,P2" : "P0,P1";
    return Array.from({ length: shards }, (_, index) => ({ ...row, priorities, shard: index + 1, shards }));
  });

export const productionPerformanceWorkloads = (channel: string) => [
  ...["storage", "runtime"].flatMap((family) =>
    forChannel(channel, ["ubuntu-24.04", "macos-15", "windows-2025"], (os) => os).map((os) => ({ family, os })),
  ),
  ...["browser", "relay", "navigation", "planner"].map((family) => ({ family, os: "ubuntu-24.04" })),
];

export const quarantineBunHosts = (channel: string) =>
  forChannel(channel, ["ubuntu-latest", "windows-latest", "macos-15"], (os) => os);

const harnessPackages = {
  "harness-codex": "@openai/codex",
  "harness-claude-code": "@anthropic-ai/claude-code",
  "harness-open-code": "opencode-ai",
  "harness-pi": "@earendil-works/pi-coding-agent",
};

export const harnessCliLanes = (channel: string) => [
  ...Object.entries(harnessPackages).map(([extension, pkg]) => ({ extension, package: pkg })),
  ...forChannel(
    channel,
    [{ extension: "harness-pi", package: harnessPackages["harness-pi"], os: "windows-latest" }],
    (row) => row.os,
  ),
];

if (import.meta.main) {
  const channel = process.env.CHANNEL!;
  appendFileSync(
    process.env.GITHUB_OUTPUT!,
    `desktop_matrix=${JSON.stringify(productionDesktopPlatforms(channel))}\nperformance_matrix=${JSON.stringify(productionPerformanceWorkloads(channel))}\n`,
  );
}
