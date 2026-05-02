import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { packageAsset } from "@pstdio/sdk/extensions";
import { PackageAssetError, readPackageAssetText, resolvePackageAssetPath } from "./package-assets";

const tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-ext-asset-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe("resolvePackageAssetPath", () => {
  test("resolves a relative asset under the source directory", () => {
    const dir = createTempDir();
    mkdirSync(join(dir, "templates"));
    writeFileSync(join(dir, "templates", "ticket.md"), "# Ticket");
    const baseUrl = pathToFileURL(join(dir, "extension.ts")).href;

    const asset = packageAsset("./templates/ticket.md", baseUrl);
    expect(resolvePackageAssetPath(asset)).toBe(join(dir, "templates", "ticket.md"));
  });

  test("rejects a path outside the asset root", () => {
    const dir = createTempDir();
    const baseUrl = pathToFileURL(join(dir, "extension.ts")).href;

    const asset = packageAsset("../escape.md", baseUrl);
    expect(() => resolvePackageAssetPath(asset)).toThrow(PackageAssetError);
  });

  test("rejects a missing asset", () => {
    const dir = createTempDir();
    const baseUrl = pathToFileURL(join(dir, "extension.ts")).href;

    const asset = packageAsset("./does-not-exist.md", baseUrl);
    expect(() => resolvePackageAssetPath(asset)).toThrow(PackageAssetError);
  });

  test("rejects an absolute path", () => {
    const dir = createTempDir();
    const baseUrl = pathToFileURL(join(dir, "extension.ts")).href;

    const asset = packageAsset("/abs/path.md", baseUrl);
    expect(() => resolvePackageAssetPath(asset)).toThrow(PackageAssetError);
  });

  test("rejects an invalid descriptor", () => {
    expect(() => resolvePackageAssetPath({ kind: "asset" } as never)).toThrow(PackageAssetError);
  });
});

describe("readPackageAssetText", () => {
  test("reads asset content", async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, "skill.md"), "skill content");
    const baseUrl = pathToFileURL(join(dir, "extension.ts")).href;

    const asset = packageAsset("./skill.md", baseUrl);
    expect(await readPackageAssetText(asset)).toBe("skill content");
  });
});
