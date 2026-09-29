import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { getExtensionApiVersionError, readPackageManifest } from "./package-manifest";

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

const [hostMajor, hostMinor, hostPatch] = EXTENSION_API_VERSION.split(".").map(Number);
const nextPatch = `${hostMajor}.${hostMinor}.${(hostPatch ?? 0) + 1}`;
const nextBreakingLine = `${hostMajor}.${(hostMinor ?? 0) + 1}.0`;
const olderBreakingLine = "0.0.9";

const versionError = (declaration: string) => readManifest(declaration).diagnostics[0]?.message ?? "";

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe("extension API version declarations", () => {
  test.each([
    `^${EXTENSION_API_VERSION}`,
    `^${olderBreakingLine} || ^${EXTENSION_API_VERSION}`,
  ])("loads an extension whose range includes this host: %s", (declaration) => {
    const result = readManifest(declaration);
    expect(result.manifest?.enginesPstdio).toBe(declaration);
    expect(result.diagnostics).toEqual([]);
  });

  test("tells the user to update Prompt Studio when the extension needs a newer API", () => {
    const result = readManifest(`^${nextPatch}`);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "extension_manifest_unsupported_api_version",
    ]);
    expect(result.diagnostics[0]?.message).toContain(nextPatch);
    expect(result.diagnostics[0]?.message).toContain(EXTENSION_API_VERSION);
    expect(result.diagnostics[0]?.message).toContain("Update Prompt Studio");
  });

  test("treats a newer breaking line as needing a newer host", () => {
    expect(versionError(`^${nextBreakingLine}`)).toContain("Update Prompt Studio");
  });

  test("tells the owner of an extension on an older breaking line to fix its source", () => {
    const message = versionError(`^${olderBreakingLine}`);

    expect(message).toContain(`"^${EXTENSION_API_VERSION}"`);
    expect(message).toContain("engines.pstdio in its package.json");
    expect(message).not.toContain("Update Prompt Studio");
  });

  test("offers an upgrade for an older catalog extension", () => {
    const message = getExtensionApiVersionError("old-extension", `^${olderBreakingLine}`, { upgradable: true });

    expect(message).toContain("Upgrade the extension");
    expect(message).not.toContain("Update Prompt Studio");
  });

  test("offers an upgrade for a catalog extension that still declares alpha versions", () => {
    const message = getExtensionApiVersionError("pstdio-planner", "1.0.0-alpha.13 || 1.0.0-alpha.14", {
      upgradable: true,
    });

    expect(message).toContain("Upgrade the extension");
  });

  test.each([
    EXTENSION_API_VERSION,
    `~${EXTENSION_API_VERSION}`,
    `>=${EXTENSION_API_VERSION}`,
    "0.x",
    "*",
    "1.0.0-alpha.14",
    "1.0.0-alpha.12 || 1.0.0-alpha.13 || 1.0.0-alpha.14",
    `^${EXTENSION_API_VERSION} || *`,
    `^${EXTENSION_API_VERSION} ||`,
  ])("shows the accepted form for a declaration that is not caret terms: %s", (declaration) => {
    const result = readManifest(declaration);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "extension_manifest_unsupported_api_version",
    ]);
    expect(result.diagnostics[0]?.message).toContain(`"^${EXTENSION_API_VERSION}"`);
  });
});
