import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSidecarTarget } from "../runtime/sidecar-artifact";

type StageSidecarInput = {
  sourcePath: string;
  resourcesPath: string;
  platform: NodeJS.Platform;
  arch: string;
  version: string;
};

export const stageSidecar = (input: StageSidecarInput) => {
  if (!existsSync(input.sourcePath)) {
    throw new Error(`Compiled desktop runtime is missing: ${input.sourcePath}`);
  }

  const target = resolveSidecarTarget(input.platform, input.arch);
  const binDir = join(input.resourcesPath, "bin");
  const binaryPath = join(binDir, target.executable);
  const manifestPath = join(binDir, "pstdio.manifest.json");
  rmSync(input.resourcesPath, { recursive: true, force: true });
  mkdirSync(binDir, { recursive: true });
  copyFileSync(input.sourcePath, binaryPath);
  if (input.platform !== "win32") chmodSync(binaryPath, 0o755);

  const checksum = createHash("sha256").update(readFileSync(binaryPath)).digest("hex");
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        platform: input.platform,
        arch: input.arch,
        version: input.version,
        checksum,
        executable: target.executable,
      },
      null,
      2,
    )}\n`,
  );

  return { binaryPath, manifestPath };
};
