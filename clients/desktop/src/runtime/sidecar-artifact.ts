import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type DesktopSidecarErrorCode =
  | "checksum_mismatch"
  | "invalid_manifest"
  | "invalid_permissions"
  | "missing_sidecar"
  | "target_mismatch"
  | "unsupported_target"
  | "version_mismatch";

export class DesktopSidecarError extends Error {
  readonly code: DesktopSidecarErrorCode;

  constructor(code: DesktopSidecarErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "DesktopSidecarError";
    this.code = code;
  }
}

type DesktopSidecarTarget = {
  packageName: string;
  executable: "pstdio" | "pstdio.exe";
};

const sidecarTargets = new Map<string, DesktopSidecarTarget>([
  ["darwin-arm64", { packageName: "cli-darwin-arm64", executable: "pstdio" }],
  ["darwin-x64", { packageName: "cli-darwin-x64", executable: "pstdio" }],
  ["linux-x64", { packageName: "cli-linux-x64", executable: "pstdio" }],
  ["win32-x64", { packageName: "cli-win-x64", executable: "pstdio.exe" }],
]);

export const resolveSidecarTarget = (platform: NodeJS.Platform, arch: string) => {
  const target = sidecarTargets.get(`${platform}-${arch}`);
  if (target) return target;
  throw new DesktopSidecarError(
    "unsupported_target",
    `Prompt Studio Desktop does not package a runtime for ${platform}-${arch}.`,
  );
};

type SidecarManifest = {
  schemaVersion: 1;
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  checksum: string;
  executable: string;
};

const parseManifest = (path: string) => {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<SidecarManifest>;
    if (
      value.schemaVersion !== 1 ||
      typeof value.platform !== "string" ||
      typeof value.arch !== "string" ||
      typeof value.version !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.checksum ?? "") ||
      typeof value.executable !== "string"
    ) {
      throw new Error("invalid fields");
    }
    return value as SidecarManifest;
  } catch {
    throw new DesktopSidecarError(
      "invalid_manifest",
      "The packaged runtime manifest is invalid. Reinstall Prompt Studio Desktop.",
    );
  }
};

const readBinaryVersion = (path: string) => {
  const result = spawnSync(path, ["--version"], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
};

type ValidateSidecarArtifactInput = {
  resourcesPath: string;
  platform: NodeJS.Platform;
  arch: string;
  appVersion: string;
  readVersion?: (path: string) => string | null;
};

export const validateSidecarArtifact = (input: ValidateSidecarArtifactInput) => {
  const target = resolveSidecarTarget(input.platform, input.arch);
  const binDir = join(input.resourcesPath, "bin");
  const binaryPath = join(binDir, target.executable);
  const manifestPath = join(binDir, "pstdio.manifest.json");
  if (!existsSync(binaryPath) || !existsSync(manifestPath)) {
    throw new DesktopSidecarError(
      "missing_sidecar",
      `The ${input.platform}-${input.arch} runtime is missing. Reinstall Prompt Studio Desktop.`,
    );
  }

  const manifest = parseManifest(manifestPath);
  if (
    manifest.platform !== input.platform ||
    manifest.arch !== input.arch ||
    manifest.executable !== target.executable
  ) {
    throw new DesktopSidecarError(
      "target_mismatch",
      `The packaged runtime targets ${manifest.platform}-${manifest.arch}, not ${input.platform}-${input.arch}.`,
    );
  }

  if (input.platform !== "win32" && (statSync(binaryPath).mode & 0o111) === 0) {
    throw new DesktopSidecarError(
      "invalid_permissions",
      "The packaged runtime is not executable. Reinstall Prompt Studio Desktop.",
    );
  }

  const checksum = createHash("sha256").update(readFileSync(binaryPath)).digest("hex");
  if (checksum !== manifest.checksum) {
    throw new DesktopSidecarError(
      "checksum_mismatch",
      "The packaged runtime failed its integrity check. Reinstall Prompt Studio Desktop.",
    );
  }

  const binaryVersion = (input.readVersion ?? readBinaryVersion)(binaryPath);
  if (manifest.version !== input.appVersion || binaryVersion !== input.appVersion) {
    throw new DesktopSidecarError(
      "version_mismatch",
      `Desktop ${input.appVersion} requires runtime ${input.appVersion}; found ${binaryVersion ?? "unreadable"}.`,
    );
  }

  return binaryPath;
};
