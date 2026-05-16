import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  test("rejects unsupported engines.pstdio ranges", () => {
    const dir = createPackage({
      name: "future",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^2.0.0" },
    });

    const result = readPackageManifest(dir);

    expect(result.manifest).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "extension_manifest_unsupported_api_version",
    );
  });

  test("rejects missing main targets", () => {
    const dir = createPackage({
      name: "missing-main",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./missing.ts",
      engines: { pstdio: "^1.0.0" },
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
      engines: { pstdio: "^1.0.0" },
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
      engines: { pstdio: "^1.0.0" },
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
      engines: { pstdio: "^1.0.0" },
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
      engines: { pstdio: "^1.0.0" },
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
