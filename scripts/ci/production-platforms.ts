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
  [
    ...productionDesktopPlatforms(channel),
    ...(channel === "nightly" ? [{ target: "win32-x64", os: "windows-2025", platform: "win32", arch: "x64" }] : []),
  ].flatMap((row) => {
    const shards = 1;
    return Array.from({ length: shards }, (_, index) => ({ ...row, shard: index + 1, shards }));
  });

// Artifact ownership is independent of priority. Linux shared CLI behavior has its own plan.

export const productionToolchainPlatforms = (channel: string) =>
  [
    { os: "ubuntu-24.04", platform_pkg: "cli-linux-x64" },
    { os: "ubuntu-24.04-arm", platform_pkg: "cli-linux-arm64" },
    { os: "macos-15", platform_pkg: "cli-darwin-arm64" },
    { os: "macos-15-intel", platform_pkg: "cli-darwin-x64" },
    { os: "windows-latest", platform_pkg: "cli-win-x64" },
    { os: "windows-11-arm", platform_pkg: "cli-win-arm64" },
  ]
    .filter(
      (row) => channel !== "nightly" || ["cli-linux-x64", "cli-darwin-arm64", "cli-win-x64"].includes(row.platform_pkg),
    )
    .flatMap((row) => {
      const shards = 1;
      const priorities = "P0,P1,P2";
      return Array.from({ length: shards }, (_, index) => ({ ...row, priorities, shard: index + 1, shards }));
    });

export const productionPerformanceWorkloads = (channel: string) => [
  ...["storage"].flatMap((family) =>
    forChannel(channel, ["ubuntu-24.04", "macos-15", "windows-2025"], (os) => os).map((os) => ({ family, os })),
  ),
  ...["planner"].map((family) => ({ family, os: "ubuntu-24.04" })),
];

export const quarantineBunHosts = (_channel: string) => ["ubuntu-latest", "windows-latest", "macos-15"];

const harnessPackages = {
  "harness-codex": "@openai/codex",
  "harness-claude-code": "@anthropic-ai/claude-code",
  "harness-open-code": "@opencode/cli",
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
