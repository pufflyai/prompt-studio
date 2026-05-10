import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvePglitePackageDir, vendorPgliteAssets } from "./vendor-pglite-assets";

describe("vendorPgliteAssets", () => {
  it("copies pglite.wasm and pglite.data from a resolved package directory", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "vendor-pglite-"));
    const pglitePackageDir = join(tempRoot, "pkg");
    const vendorDir = join(tempRoot, "vendor");
    const distDir = join(pglitePackageDir, "dist");

    try {
      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, "pglite.wasm"), Buffer.from("WASM"));
      writeFileSync(join(distDir, "pglite.data"), Buffer.from("DATA"));

      const results = vendorPgliteAssets({ vendorDir, pglitePackageDir });

      expect(results.map((r) => r.asset).sort()).toEqual(["pglite.data", "pglite.wasm"]);
      expect(results.every((r) => r.copied)).toBe(true);
      expect(readFileSync(join(vendorDir, "pglite.wasm")).toString()).toBe("WASM");
      expect(readFileSync(join(vendorDir, "pglite.data")).toString()).toBe("DATA");
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("is idempotent when destination files are already up to date", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "vendor-pglite-idempotent-"));
    const pglitePackageDir = join(tempRoot, "pkg");
    const vendorDir = join(tempRoot, "vendor");
    const distDir = join(pglitePackageDir, "dist");

    try {
      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, "pglite.wasm"), Buffer.from("WASM"));
      writeFileSync(join(distDir, "pglite.data"), Buffer.from("DATA"));

      vendorPgliteAssets({ vendorDir, pglitePackageDir });
      const second = vendorPgliteAssets({ vendorDir, pglitePackageDir });

      expect(second.every((r) => r.copied === false)).toBe(true);
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("throws when source assets are missing", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "vendor-pglite-missing-"));
    const pglitePackageDir = join(tempRoot, "pkg");
    const vendorDir = join(tempRoot, "vendor");

    try {
      mkdirSync(join(pglitePackageDir, "dist"), { recursive: true });
      expect(() => vendorPgliteAssets({ vendorDir, pglitePackageDir })).toThrow(/Expected PGlite asset is missing/);
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});

describe("resolvePglitePackageDir", () => {
  it("locates the @electric-sql/pglite package directory shipping the runtime assets", () => {
    const pgliteDir = resolvePglitePackageDir();

    expect(existsSync(join(pgliteDir, "package.json"))).toBe(true);
    expect(existsSync(join(pgliteDir, "dist", "pglite.wasm"))).toBe(true);
    expect(existsSync(join(pgliteDir, "dist", "pglite.data"))).toBe(true);
  });
});
