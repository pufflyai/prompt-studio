import { appendFileSync } from "node:fs";

export const productionDesktopPlatforms = (channel: string) =>
  [
    { target: "linux-x64", os: "ubuntu-24.04", platform: "linux", arch: "x64" },
    { target: "darwin-arm64", os: "macos-15", platform: "darwin", arch: "arm64" },
    { target: "darwin-x64", os: "macos-15-intel", platform: "darwin", arch: "x64" },
    { target: "win32-x64", os: "windows-2025", platform: "win32", arch: "x64" },
  ].filter((row) => channel !== "nightly" || row.target !== "darwin-x64");

export const publishedDesktopTargets = (channel: string) =>
  productionDesktopPlatforms(channel)
    .filter((row) => channel !== "nightly" || row.platform !== "win32")
    .map((row) => row.target);

export const productionDesktopCheckPlatforms = (channel: string) =>
  productionDesktopPlatforms(channel).flatMap((row) => {
    const shards = row.target === "darwin-x64" ? 2 : 1;
    return Array.from({ length: shards }, (_, index) => ({ ...row, shard: index + 1, shards }));
  });

export const productionToolchainPlatforms = (channel: string) =>
  [
    { os: "ubuntu-24.04", platform_pkg: "cli-linux-x64" },
    { os: "ubuntu-24.04-arm", platform_pkg: "cli-linux-arm64" },
    { os: "macos-15", platform_pkg: "cli-darwin-arm64" },
    { os: "macos-15-intel", platform_pkg: "cli-darwin-x64" },
    { os: "windows-latest", platform_pkg: "cli-win-x64" },
    { os: "windows-11-arm", platform_pkg: "cli-win-arm64" },
  ].filter((row) => channel !== "nightly" || row.platform_pkg !== "cli-darwin-x64");

if (import.meta.main)
  appendFileSync(
    process.env.GITHUB_OUTPUT!,
    `desktop_matrix=${JSON.stringify(productionDesktopPlatforms(process.env.CHANNEL!))}\n`,
  );
