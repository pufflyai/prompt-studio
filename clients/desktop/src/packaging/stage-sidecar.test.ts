import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSidecarArtifact } from "../runtime/sidecar-artifact";
import { stageSidecar } from "./stage-sidecar";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.length = 0;
});

test("stages exactly one executable sidecar with a verifiable manifest", () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-sidecar-stage-"));
  roots.push(root);
  const sourcePath = join(root, "build", "pstdio");
  const resourcesPath = join(root, "resources");
  mkdirSync(join(root, "build"), { recursive: true });
  writeFileSync(sourcePath, "compiled-runtime");

  const result = stageSidecar({
    sourcePath,
    resourcesPath,
    platform: "darwin",
    arch: "arm64",
    version: "0.25.2",
  });

  expect(result.binaryPath).toBe(join(resourcesPath, "bin", "pstdio"));
  expect(statSync(result.binaryPath).mode & 0o111).not.toBe(0);
  expect(readFileSync(result.binaryPath, "utf8")).toBe("compiled-runtime");
  expect(
    validateSidecarArtifact({
      resourcesPath,
      platform: "darwin",
      arch: "arm64",
      appVersion: "0.25.2",
      readVersion: () => "0.25.2",
    }),
  ).toBe(result.binaryPath);
});

describe("stageSidecar", () => {
  test("rejects a missing compiled source", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-sidecar-missing-"));
    roots.push(root);

    expect(() =>
      stageSidecar({
        sourcePath: join(root, "missing"),
        resourcesPath: join(root, "resources"),
        platform: "darwin",
        arch: "arm64",
        version: "0.25.2",
      }),
    ).toThrow("Compiled desktop runtime is missing");
  });
});
