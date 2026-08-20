import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { readPackageManifest } from "./package-manifest";

const tempDirs: string[] = [];

const createPackage = (manifest: Record<string, unknown>) => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-manifest-"));
  tempDirs.push(dir);
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("readPackageManifest", () => {
  test("reads pstdio scope when declared", () => {
    const dir = createPackage({
      name: "repo-extension",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      pstdio: { scope: "repo" },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest?.pstdio?.scope).toBe("repo");
    expect(result.diagnostics).toEqual([]);
  });

  test("allows package manifests without pstdio scope", () => {
    const dir = createPackage({
      name: "user-extension",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest?.pstdio).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  test("rejects invalid pstdio scope declarations", () => {
    const dir = createPackage({
      name: "bad-scope",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      pstdio: { scope: "workspace" },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'pstdio.scope "workspace" must be "user" or "repo"',
    );
  });

  test("rejects non-object pstdio declarations", () => {
    const dir = createPackage({
      name: "bad-pstdio",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
      pstdio: "repo",
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain("pstdio must be an object");
  });

  test("reports each missing required field", () => {
    const dir = createPackage({ name: "broken", version: "1.0.0" });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'package.json is missing required field "publisher"',
      'package.json is missing required field "main"',
      'package.json is missing required field "engines.pstdio"',
    ]);
  });

  test("rejects an extension built for a different API version", () => {
    const dir = createPackage({
      name: "future",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "1.0.0-alpha.999" },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "extension_manifest_unsupported_api_version",
    ]);
    expect(result.diagnostics[0]?.message).toContain("1.0.0-alpha.999");
    expect(result.diagnostics[0]?.message).toContain(EXTENSION_API_VERSION);
  });

  test("rejects a range while the API is in alpha", () => {
    const dir = createPackage({
      name: "ranged",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0-alpha.1" },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "extension_manifest_unsupported_api_version",
    ]);
    expect(result.diagnostics[0]?.message).toContain("exact");
  });

  test("accepts an extension declaring the host API version", () => {
    const dir = createPackage({
      name: "current",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest?.enginesPstdio).toBe(EXTENSION_API_VERSION);
    expect(result.diagnostics).toEqual([]);
  });

  test("rejects missing main targets", () => {
    const dir = createPackage({
      name: "missing-main",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./missing.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("extension_entry_not_found");
  });

  test("rejects directory main targets", () => {
    const dir = createPackage({
      name: "directory-main",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./src",
      engines: { pstdio: EXTENSION_API_VERSION },
    });
    mkdirSync(join(dir, "src"));

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain('main "./src" must point to a file');
  });

  test("rejects absolute main paths", () => {
    const absoluteMain = join(tmpdir(), "outside-extension.ts");
    const dir = createPackage({
      name: "absolute-main",
      version: "1.0.0",
      publisher: "pstdio",
      main: absoluteMain,
      engines: { pstdio: EXTENSION_API_VERSION },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      `main "${absoluteMain}" must be a relative path`,
    );
  });

  test("rejects parent-relative main paths", () => {
    const dir = createPackage({
      name: "parent-main",
      version: "1.0.0",
      publisher: "pstdio",
      main: "../outside.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    });
    writeFileSync(join(dir, "..", "outside.ts"), "export default {};\n");

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'main "../outside.ts" resolves outside the package directory',
    );
  });

  test("rejects symlinked main targets outside the package", () => {
    const dir = createPackage({
      name: "symlink-main",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./linked.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    });
    const outside = join(dir, "..", "outside-linked.ts");
    writeFileSync(outside, "export default {};\n");
    symlinkSync(outside, join(dir, "linked.ts"));

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toContain(
      'main "./linked.ts" resolves outside the package directory',
    );
  });
});
