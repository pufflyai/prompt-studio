import { describe, expect, test } from "bun:test";
import {
  DesktopReleaseConfigError,
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
      osxNotarize: {
        appleApiKey: "/tmp/AuthKey_KEY.p8",
        appleApiKeyId: "KEY",
        appleApiIssuer: "issuer",
      },
    });
  });

  test("requires the Windows certificate and never enables signing for local builds", () => {
    expect(() =>
      resolveDesktopSigning({
        platform: "win32",
        release: true,
        env: { WINDOWS_CERTIFICATE_FILE: "C:/temp/certificate.pfx" },
      }),
    ).toThrow("WINDOWS_CERTIFICATE_PASSWORD");

    expect(
      resolveDesktopSigning({
        platform: "win32",
        release: false,
        env: {},
      }),
    ).toEqual({});
  });
});

describe("desktop update strategy", () => {
  test("uses the signed GitHub release channel on supported native updaters", () => {
    expect(resolveDesktopUpdateStrategy("darwin")).toEqual({ kind: "automatic" });
    expect(resolveDesktopUpdateStrategy("win32")).toEqual({ kind: "automatic" });
  });

  test("keeps Linux on the documented manual release path", () => {
    expect(resolveDesktopUpdateStrategy("linux")).toEqual({
      kind: "manual",
      releasesUrl: "https://github.com/pufflyai/prompt-studio/releases",
    });
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
        fetchReleases: async () => releases,
      }),
    ).toBe("https://github.com/pufflyai/prompt-studio/releases/download/pstdio@0.25.3/RELEASES-darwin-arm64.json");
    expect(
      await resolveDesktopUpdateFeed({
        platform: "win32",
        arch: "x64",
        fetchReleases: async () => releases,
      }),
    ).toBe("https://github.com/pufflyai/prompt-studio/releases/download/pstdio@0.25.3");
  });

  test("rejects a release whose native update set is incomplete", async () => {
    expect(
      resolveDesktopUpdateFeed({
        platform: "darwin",
        arch: "x64",
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
