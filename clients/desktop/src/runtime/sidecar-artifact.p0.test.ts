import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopSidecarError, resolveSidecarTarget, validateSidecarArtifact } from "./sidecar-artifact";

const roots: string[] = [];
const platform = process.platform === "win32" ? "win32" : "darwin";
const executable = platform === "win32" ? "pstdio.exe" : "pstdio";

const createArtifact = (overrides: Partial<Record<"platform" | "arch" | "version" | "checksum", string>> = {}) => {
  const resourcesPath = mkdtempSync(join(tmpdir(), "pstdio-desktop-sidecar-"));
  roots.push(resourcesPath);
  const binDir = join(resourcesPath, "bin");
  const binaryPath = join(binDir, executable);
  const content = "compiled-runtime";
  mkdirSync(binDir, { recursive: true });
  writeFileSync(binaryPath, content);
  chmodSync(binaryPath, 0o755);
  writeFileSync(
    join(binDir, "pstdio.manifest.json"),
    JSON.stringify({
      schemaVersion: 1,
      platform: overrides.platform ?? platform,
      arch: overrides.arch ?? "x64",
      version: overrides.version ?? "0.25.2",
      checksum: overrides.checksum ?? createHash("sha256").update(content).digest("hex"),
      executable,
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

  test("accepts a matching executable, checksum, target, and reported version", async () => {
    const artifact = createArtifact();

    await expect(
      validateSidecarArtifact({
        resourcesPath: artifact.resourcesPath,
        platform,
        arch: "x64",
        appVersion: "0.25.2",
        readVersion: () => "0.25.2",
      }),
    ).resolves.toBe(artifact.binaryPath);
  });

  test("waits for the version check without blocking the caller", async () => {
    const artifact = createArtifact();
    const version = Promise.withResolvers<string>();
    const validation = validateSidecarArtifact({
      resourcesPath: artifact.resourcesPath,
      platform,
      arch: "x64",
      appVersion: "0.25.2",
      readVersion: () => version.promise,
    });
    let validated = false;
    const completion = Promise.resolve(validation).then((path) => {
      validated = true;
      return path;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(validated).toBe(false);
    version.resolve("0.25.2");
    await expect(completion).resolves.toBe(artifact.binaryPath);
  });

  test.each([
    ["missing_sidecar", () => ({ resourcesPath: mkdtempSync(join(tmpdir(), "pstdio-empty-sidecar-")) })],
    ["target_mismatch", () => createArtifact({ arch: "arm64" })],
    ["checksum_mismatch", () => createArtifact({ checksum: "0".repeat(64) })],
    ["version_mismatch", () => createArtifact({ version: "0.25.1" })],
  ] as const)("fails before launch with %s", async (code, create) => {
    const artifact = create();
    roots.push(artifact.resourcesPath);

    try {
      await validateSidecarArtifact({
        resourcesPath: artifact.resourcesPath,
        platform,
        arch: "x64",
        appVersion: "0.25.2",
        readVersion: () => "0.25.2",
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DesktopSidecarError);
      expect((error as DesktopSidecarError).code).toBe(code);
    }
  });

  test("rejects a binary whose own version drifts from the application", async () => {
    const artifact = createArtifact();

    await expect(
      validateSidecarArtifact({
        resourcesPath: artifact.resourcesPath,
        platform,
        arch: "x64",
        appVersion: "0.25.2",
        readVersion: () => "0.25.1",
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "version_mismatch" }));
  });
});
