import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopSidecarError, resolveSidecarTarget, validateSidecarArtifact } from "./sidecar-artifact";

const roots: string[] = [];

const createArtifact = (overrides: Partial<Record<"platform" | "arch" | "version" | "checksum", string>> = {}) => {
  const resourcesPath = mkdtempSync(join(tmpdir(), "pstdio-desktop-sidecar-"));
  roots.push(resourcesPath);
  const binDir = join(resourcesPath, "bin");
  const binaryPath = join(binDir, "pstdio");
  const content = "compiled-runtime";
  mkdirSync(binDir, { recursive: true });
  writeFileSync(binaryPath, content);
  chmodSync(binaryPath, 0o755);
  writeFileSync(
    join(binDir, "pstdio.manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      platform: overrides.platform ?? "darwin",
      arch: overrides.arch ?? "arm64",
      version: overrides.version ?? "0.25.2",
      checksum: overrides.checksum ?? createHash("sha256").update(content).digest("hex"),
      executable: "pstdio",
    }),
  );
  return { binaryPath, resourcesPath };
};

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

describe("desktop sidecar artifact", () => {
  test("selects the single declared package for a supported platform and architecture", () => {
    expect(resolveSidecarTarget("darwin", "arm64")).toEqual({
      packageName: "cli-darwin-arm64",
      executable: "pstdio",
    });
    expect(resolveSidecarTarget("win32", "x64")).toEqual({
      packageName: "cli-win-x64",
      executable: "pstdio.exe",
    });
  });

  test("rejects a target outside the desktop release matrix", () => {
    expect(() => resolveSidecarTarget("linux", "arm64")).toThrow(
      expect.objectContaining({ code: "unsupported_target" }),
    );
  });

  test("accepts a matching executable, checksum, target, and reported version", () => {
    const artifact = createArtifact();

    expect(
      validateSidecarArtifact({
        resourcesPath: artifact.resourcesPath,
        platform: "darwin",
        arch: "arm64",
        appVersion: "0.25.2",
        readVersion: () => "0.25.2",
      }),
    ).toBe(artifact.binaryPath);
  });

  test.each([
    ["missing_sidecar", () => ({ resourcesPath: mkdtempSync(join(tmpdir(), "pstdio-empty-sidecar-")) })],
    ["target_mismatch", () => createArtifact({ arch: "x64" })],
    ["checksum_mismatch", () => createArtifact({ checksum: "0".repeat(64) })],
    ["version_mismatch", () => createArtifact({ version: "0.25.1" })],
  ] as const)("fails before launch with %s", (code, create) => {
    const artifact = create();
    roots.push(artifact.resourcesPath);

    try {
      validateSidecarArtifact({
        resourcesPath: artifact.resourcesPath,
        platform: "darwin",
        arch: "arm64",
        appVersion: "0.25.2",
        readVersion: () => "0.25.2",
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DesktopSidecarError);
      expect((error as DesktopSidecarError).code).toBe(code);
    }
  });

  test("rejects a binary whose own version drifts from the application", () => {
    const artifact = createArtifact();

    expect(() =>
      validateSidecarArtifact({
        resourcesPath: artifact.resourcesPath,
        platform: "darwin",
        arch: "arm64",
        appVersion: "0.25.2",
        readVersion: () => "0.25.1",
      }),
    ).toThrow(expect.objectContaining({ code: "version_mismatch" }));
  });
});
