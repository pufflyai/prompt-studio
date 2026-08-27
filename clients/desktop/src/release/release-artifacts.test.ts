import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type DesktopReleaseManifest,
  parseDesktopReleaseTarget,
  prepareDesktopReleaseArtifacts,
  verifyDesktopReleaseSet,
} from "./release-artifacts";

const roots: string[] = [];

const write = (path: string, content: string) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
};

const fixture = (target: "darwin-arm64" | "darwin-x64" | "linux-x64" | "win32-x64") => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-release-"));
  roots.push(root);
  const desktopRoot = join(root, "clients", "desktop");
  const runtimePackagePath = join(root, "packages", "pstdio", "package.json");
  write(join(desktopRoot, "package.json"), JSON.stringify({ version: "1.2.3" }));
  write(runtimePackagePath, JSON.stringify({ version: "1.2.3" }));
  const [platform, arch] = target.split("-") as [NodeJS.Platform, string];
  const executable = platform === "win32" ? "pstdio.exe" : "pstdio";
  const binary = "signed-sidecar";
  write(join(desktopRoot, ".sidecar", "bin", executable), binary);
  write(
    join(desktopRoot, ".sidecar", "bin", "pstdio.manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      platform,
      arch,
      version: "1.2.3",
      executable,
      checksum: createHash("sha256").update(binary).digest("hex"),
    }),
  );
  return { root, desktopRoot, runtimePackagePath };
};

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe("prepareDesktopReleaseArtifacts", () => {
  test("normalizes macOS distributions and emits matching update metadata and checksums", () => {
    const { desktopRoot, runtimePackagePath } = fixture("darwin-arm64");
    write(join(desktopRoot, "out", "make", "Prompt Studio.dmg"), "dmg");
    write(join(desktopRoot, "out", "make", "zip", "darwin", "arm64", "Prompt Studio-darwin-arm64-1.2.3.zip"), "zip");

    const result = prepareDesktopReleaseArtifacts({
      desktopRoot,
      runtimePackagePath,
      target: "darwin-arm64",
      releaseNotes: "Desktop release notes",
      publishedAt: "2026-08-06T00:00:00.000Z",
    });

    expect(result.manifest.componentVersions).toEqual({
      application: "1.2.3",
      dashboard: "1.2.3",
      installer: "1.2.3",
      sidecar: "1.2.3",
      updateMetadata: "1.2.3",
    });
    expect(result.manifest.assets.map((asset) => asset.name)).toEqual([
      "Prompt-Studio-1.2.3-darwin-arm64.dmg",
      "Prompt-Studio-1.2.3-darwin-arm64.zip",
      "RELEASES-darwin-arm64.json",
    ]);
    expect(JSON.parse(readFileSync(join(result.outputPath, "RELEASES-darwin-arm64.json"), "utf8"))).toMatchObject({
      version: "1.2.3",
      notes: "Desktop release notes",
      url: "https://github.com/pufflyai/prompt-studio/releases/download/pstdio@1.2.3/Prompt-Studio-1.2.3-darwin-arm64.zip",
    });
    expect(readFileSync(result.checksumsPath, "utf8")).toContain("Prompt-Studio-1.2.3-darwin-arm64.zip");
  });

  test("rejects component version drift before publication", () => {
    const { desktopRoot, runtimePackagePath } = fixture("linux-x64");
    writeFileSync(runtimePackagePath, JSON.stringify({ version: "1.2.4" }));
    write(join(desktopRoot, "out", "make", "prompt-studio_1.2.3_amd64.deb"), "deb");
    write(join(desktopRoot, "out", "make", "Prompt Studio-linux-x64-1.2.3.zip"), "zip");

    expect(() =>
      prepareDesktopReleaseArtifacts({
        desktopRoot,
        runtimePackagePath,
        target: "linux-x64",
        releaseNotes: "notes",
        publishedAt: "2026-08-06T00:00:00.000Z",
      }),
    ).toThrow("Desktop 1.2.3 does not match runtime 1.2.4");
  });
});

test("parseDesktopReleaseTarget disables Windows until its release lane is restored", () => {
  expect(parseDesktopReleaseTarget("darwin-arm64")).toBe("darwin-arm64");
  expect(parseDesktopReleaseTarget("darwin-x64")).toBe("darwin-x64");
  expect(parseDesktopReleaseTarget("linux-x64")).toBe("linux-x64");
  expect(() => parseDesktopReleaseTarget("win32-x64")).toThrow("Unsupported desktop release target win32-x64");
});

test("verifyDesktopReleaseSet requires one version and the complete native matrix", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-desktop-release-set-"));
  roots.push(root);
  const targets = ["darwin-arm64", "darwin-x64", "linux-x64"] as const;
  for (const target of targets) {
    const manifest: DesktopReleaseManifest = {
      schemaVersion: 1,
      target,
      version: "1.2.3",
      releaseTag: "pstdio@1.2.3",
      updateMode: target === "linux-x64" ? "manual" : "automatic",
      componentVersions: {
        application: "1.2.3",
        dashboard: "1.2.3",
        installer: "1.2.3",
        sidecar: "1.2.3",
        updateMetadata: "1.2.3",
      },
      assets: [],
    };
    write(join(root, target, `desktop-release-${target}.json`), JSON.stringify(manifest));
  }

  expect(verifyDesktopReleaseSet(root)).toEqual({ version: "1.2.3", releaseTag: "pstdio@1.2.3" });
  rmSync(join(root, "linux-x64"), { recursive: true });
  expect(() => verifyDesktopReleaseSet(root)).toThrow("Missing desktop release target linux-x64");
});
