import { describe, expect, test } from "bun:test";
import {
  DesktopReleaseConfigError,
  resolveDesktopReleasePage,
  resolveDesktopSigning,
  resolveDesktopUpdateFeed,
  resolveDesktopUpdateStrategy,
} from "./release-config";

describe("desktop release configuration", () => {
  test("requires every macOS signing and notarization credential for release builds", () => {
    expect(() =>
      resolveDesktopSigning({
        platform: "darwin",
        release: true,
        env: { MACOS_SIGN_IDENTITY: "Developer ID Application: Prompt Studio" },
      }),
    ).toThrow(DesktopReleaseConfigError);

    expect(
      resolveDesktopSigning({
        platform: "darwin",
        release: true,
        env: {
          MACOS_SIGN_IDENTITY: "Developer ID Application: Prompt Studio",
          APPLE_API_KEY: "/tmp/AuthKey_KEY.p8",
          APPLE_API_KEY_ID: "KEY",
          APPLE_API_ISSUER: "issuer",
        },
      }),
    ).toEqual({
      osxSign: {
        identity: "Developer ID Application: Prompt Studio",
      },
      macosNotarization: {
        appleApiKey: "/tmp/AuthKey_KEY.p8",
        appleApiKeyId: "KEY",
        appleApiIssuer: "issuer",
      },
    });
  });

  test("requires Azure signing tools and never enables signing for local builds", () => {
    expect(() =>
      resolveDesktopSigning({
        platform: "win32",
        release: true,
        env: {},
      }),
    ).toThrow("AZURE_SIGNING_METADATA");

    expect(
      resolveDesktopSigning({
        platform: "win32",
        release: false,
        env: {},
      }),
    ).toEqual({});
  });
});

const macRelease = (version: string, options: { prerelease?: boolean; draft?: boolean } = {}) => ({
  tag_name: `pstdio@${version}`,
  draft: options.draft ?? false,
  prerelease: options.prerelease ?? version.includes("-"),
  assets: [
    { name: `Prompt-Studio-${version}-darwin-arm64.zip` },
    { name: "RELEASES-darwin-arm64.json" },
    { name: `Prompt-Studio-${version}-linux-x64.deb` },
  ],
});

const feedVersion = async (channel: "stable" | "nightly", releases: ReturnType<typeof macRelease>[]) =>
  (await resolveDesktopUpdateFeed({ platform: "darwin", arch: "arm64", channel, fetchReleases: async () => releases }))
    .version;

describe("desktop update strategy", () => {
  test("uses the signed GitHub release channel on supported native updaters", () => {
    expect(resolveDesktopUpdateStrategy("darwin")).toEqual({ kind: "automatic" });
    expect(resolveDesktopUpdateStrategy("win32")).toEqual({ kind: "automatic" });
  });

  test("keeps Linux on the documented manual release path", () => {
    expect(resolveDesktopUpdateStrategy("linux")).toEqual({ kind: "manual" });
  });

  test("resolves feeds from the newest complete pstdio package release", async () => {
    const releases = [
      {
        tag_name: "@pstdio/ui@9.0.0",
        draft: false,
        prerelease: false,
        assets: [{ name: "unrelated.zip" }],
      },
      {
        tag_name: "pstdio@0.25.3",
        draft: false,
        prerelease: false,
        assets: [
          { name: "Prompt-Studio-0.25.3-darwin-arm64.zip" },
          { name: "RELEASES-darwin-arm64.json" },
          { name: "Prompt-Studio-0.25.3-win32-x64-Setup.exe" },
          { name: "promptstudio-0.25.3-full.nupkg" },
          { name: "RELEASES" },
        ],
      },
    ];

    expect(
      await resolveDesktopUpdateFeed({
        platform: "darwin",
        arch: "arm64",
        channel: "stable",
        fetchReleases: async () => releases,
      }),
    ).toEqual({
      version: "0.25.3",
      url: "https://github.com/pufflyai/prompt-studio/releases/download/pstdio@0.25.3/RELEASES-darwin-arm64.json",
    });
    expect(
      await resolveDesktopUpdateFeed({
        platform: "win32",
        arch: "x64",
        channel: "stable",
        fetchReleases: async () => releases,
      }),
    ).toEqual({ version: "0.25.3", url: "https://github.com/pufflyai/prompt-studio/releases/download/pstdio@0.25.3" });
  });

  test("rejects a release whose native update set is incomplete", async () => {
    expect(
      resolveDesktopUpdateFeed({
        platform: "darwin",
        arch: "x64",
        channel: "nightly",
        fetchReleases: async () => [
          {
            tag_name: "pstdio@0.25.3",
            draft: false,
            prerelease: false,
            assets: [{ name: "Prompt-Studio-0.25.3-darwin-x64.zip" }],
          },
        ],
      }),
    ).rejects.toThrow("No complete darwin-x64 desktop update release is published");
  });
});

describe("desktop update channels", () => {
  test("stable ignores nightly builds, other prereleases and drafts", async () => {
    const releases = [
      macRelease("0.42.3"),
      macRelease("0.42.4", { prerelease: true }),
      macRelease("0.43.0-nightly.20261011030000"),
      macRelease("0.43.0-rc.1"),
      macRelease("0.44.0", { draft: true }),
    ];
    expect(await feedVersion("stable", releases)).toBe("0.42.3");
  });

  test("nightly picks the newest of stable releases and nightly builds", async () => {
    const releases = [
      macRelease("0.42.3"),
      macRelease("0.43.0-nightly.20261010030000"),
      macRelease("0.43.0-nightly.20261011030000"),
      macRelease("0.43.0-rc.1"),
    ];
    expect(await feedVersion("nightly", releases)).toBe("0.43.0-nightly.20261011030000");
  });

  test("a stable release replaces nightly builds of the same version", async () => {
    const releases = [macRelease("0.43.0-nightly.20261011030000"), macRelease("0.43.0")];
    expect(await feedVersion("nightly", releases)).toBe("0.43.0");
  });

  test("nightly skips a build whose native update set is still incomplete", async () => {
    const incomplete = { ...macRelease("0.43.0-nightly.20261012030000"), assets: [] };
    const releases = [macRelease("0.43.0-nightly.20261011030000"), incomplete];
    expect(await feedVersion("nightly", releases)).toBe("0.43.0-nightly.20261011030000");
  });

  test("Linux opens the newest release page with a Linux package for the chosen channel", async () => {
    const releases = [macRelease("0.42.3"), macRelease("0.43.0-nightly.20261011030000")];
    const page = (channel: "stable" | "nightly") =>
      resolveDesktopReleasePage({ platform: "linux", arch: "x64", channel, fetchReleases: async () => releases });
    expect(await page("stable")).toEqual({
      version: "0.42.3",
      url: "https://github.com/pufflyai/prompt-studio/releases/tag/pstdio@0.42.3",
    });
    expect(await page("nightly")).toEqual({
      version: "0.43.0-nightly.20261011030000",
      url: "https://github.com/pufflyai/prompt-studio/releases/tag/pstdio@0.43.0-nightly.20261011030000",
    });
  });
});
