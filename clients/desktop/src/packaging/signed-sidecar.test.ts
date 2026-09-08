import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSidecarArtifact } from "../runtime/sidecar-artifact";
import { stageSidecar } from "./stage-sidecar";

test.skipIf(process.platform !== "darwin")("signs the runtime before recording its packaged checksum", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-signed-sidecar-"));
  try {
    const entrypoint = join(root, "runtime.ts");
    const sourcePath = join(root, "runtime");
    writeFileSync(entrypoint, 'console.log("0.31.0");');
    const build = spawnSync("bun", ["build", "--compile", entrypoint, "--outfile", sourcePath], {
      encoding: "utf8",
    });
    expect(build.status, build.stderr).toBe(0);
    const resourcesPath = join(root, "resources");
    const staged = stageSidecar({
      sourcePath,
      resourcesPath,
      platform: "darwin",
      arch: process.arch,
      version: "0.31.0",
      macosSignIdentity: "-",
    });

    const signature = spawnSync("codesign", ["--display", "--verbose=4", staged.binaryPath], {
      encoding: "utf8",
    });
    expect(signature.status, signature.stderr).toBe(0);
    expect(signature.stderr).toMatch(/flags=.*\bruntime\b/);
    const verify = spawnSync("codesign", ["--verify", "--strict", staged.binaryPath], { encoding: "utf8" });
    expect(verify.status, verify.stderr).toBe(0);
    expect(readFileSync(staged.binaryPath).equals(readFileSync(sourcePath))).toBe(false);
    await expect(
      validateSidecarArtifact({ resourcesPath, platform: "darwin", arch: process.arch, appVersion: "0.31.0" }),
    ).resolves.toBe(staged.binaryPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
