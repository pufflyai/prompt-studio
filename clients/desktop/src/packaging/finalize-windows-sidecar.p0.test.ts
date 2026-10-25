import { expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSidecarArtifact } from "../runtime/sidecar-artifact";
import { finalizeWindowsSidecar } from "./finalize-windows-sidecar";
import { stageSidecar } from "./stage-sidecar";

test("records the final Windows runtime bytes after packaging signs the executable", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-windows-signing-"));
  try {
    const sourcePath = join(root, "compiled.exe");
    const resourcesPath = join(root, "resources");
    writeFileSync(sourcePath, "compiled runtime");
    const input = {
      resourcesPath,
      platform: "win32" as const,
      arch: "x64",
      appVersion: "0.34.0",
      readVersion: () => "0.34.0",
    };
    const staged = stageSidecar({ ...input, sourcePath, version: input.appVersion });
    // Authenticode appends certificate data to the executable after staging.
    appendFileSync(staged.binaryPath, "certificate and timestamp");
    await expect(validateSidecarArtifact(input)).rejects.toThrow("checksum_mismatch");
    finalizeWindowsSidecar(resourcesPath);
    await expect(validateSidecarArtifact(input)).resolves.toBe(staged.binaryPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
