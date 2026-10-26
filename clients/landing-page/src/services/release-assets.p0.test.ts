import { expect, test } from "bun:test";
import { type GitHubRelease, latestDesktopRelease, preferredDownload } from "./release-assets";

// Asset names published by the pstdio@0.37.0 desktop release.
const release: GitHubRelease = {
  tag_name: "pstdio@0.37.0",
  draft: false,
  prerelease: false,
  assets: [
    "Prompt-Studio-0.37.0-darwin-arm64.dmg",
    "Prompt-Studio-0.37.0-darwin-arm64.zip",
    "Prompt-Studio-0.37.0-darwin-x64.dmg",
    "Prompt-Studio-0.37.0-darwin-x64.zip",
    "Prompt-Studio-0.37.0-linux-x64.deb",
    "Prompt-Studio-0.37.0-linux-x64.zip",
    "Prompt-Studio-0.37.0-win32-x64-Setup.exe",
    "prompt_studio-0.37.0-full.nupkg",
    "RELEASES",
  ].map((name) => ({ name, browser_download_url: `https://example.test/${name}`, size: 1 })),
};

const windowsUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0";

test("offers every published desktop installer", () => {
  expect(latestDesktopRelease([release])?.downloads.map((download) => download.id)).toEqual([
    "darwin-arm64-dmg",
    "darwin-x64-dmg",
    "linux-x64-deb",
    "linux-x64-zip",
    "win32-x64-exe",
  ]);
});

test("selects the Windows installer for Windows visitors", () => {
  const downloads = latestDesktopRelease([release])!.downloads;
  expect(preferredDownload(downloads, windowsUserAgent, 0)?.url).toBe(
    "https://example.test/Prompt-Studio-0.37.0-win32-x64-Setup.exe",
  );
});

test("never offers a nightly build, even when it is newer", () => {
  const nightlyVersion = "0.43.0-nightly.20261011183426";
  const nightly: GitHubRelease = {
    tag_name: `pstdio@${nightlyVersion}`,
    draft: false,
    prerelease: true,
    assets: ["darwin-arm64.dmg", "darwin-x64.dmg", "linux-x64.deb"].map((suffix) => {
      const name = `Prompt-Studio-${nightlyVersion}-${suffix}`;
      return { name, browser_download_url: `https://example.test/${name}`, size: 1 };
    }),
  };

  expect(latestDesktopRelease([nightly, release])?.version).toBe("0.37.0");
  // The version check also holds if a nightly were ever published without the prerelease flag.
  expect(latestDesktopRelease([{ ...nightly, prerelease: false }, release])?.version).toBe("0.37.0");
});
