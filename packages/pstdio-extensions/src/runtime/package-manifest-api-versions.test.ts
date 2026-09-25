import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { readPackageManifest } from "./package-manifest";

const directories: string[] = [];

const readManifest = (declaration: string) => {
  const directory = mkdtempSync(join(tmpdir(), "pstdio-api-versions-"));
  directories.push(directory);
  writeFileSync(join(directory, "extension.ts"), "export default {};\n");
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({
      name: "compatible-extension",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: declaration },
    }),
  );
  return readPackageManifest(directory);
};

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe("extension API version declarations", () => {
  test.each([
    `${EXTENSION_API_VERSION} || 1.0.0-alpha.11`,
    `1.0.0-alpha.11 || ${EXTENSION_API_VERSION}`,
  ])("loads an extension that explicitly supports this host: %s", (declaration) => {
    const result = readManifest(declaration);
    expect(result.manifest?.enginesPstdio).toBe(declaration);
    expect(result.diagnostics).toEqual([]);
  });

  test("does not infer support for an unlisted host between two versions", () => {
    const result = readManifest("1.0.0-alpha.9 || 1.0.0-alpha.11");
    expect(result.manifest).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "extension_manifest_unsupported_api_version" }),
    );
  });

  test.each([
    `^${EXTENSION_API_VERSION}`,
    `~${EXTENSION_API_VERSION}`,
    `>=${EXTENSION_API_VERSION}`,
    "1.0.0-alpha.*",
    "*",
    `${EXTENSION_API_VERSION} || *`,
    `${EXTENSION_API_VERSION} || ^1.0.0-alpha.11`,
    `${EXTENSION_API_VERSION} ||`,
  ])("rejects declarations that do not enumerate exact versions: %s", (declaration) => {
    const result = readManifest(declaration);
    expect(result.manifest).toBeNull();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "extension_manifest_unsupported_api_version" }),
    );
  });
});
