import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkExtensionApiVersions, readExtensionManifests } from "./verify-extension-api-version";

const HOST_VERSION = "0.4.3";
const manifest = (enginesPstdio: string) => [{ file: "extensions/planner/package.json", enginesPstdio }];

describe("checkExtensionApiVersions", () => {
  test.each([
    "^0.4.0",
    "^0.4.3",
    "^0.3.0 || ^0.4.0",
  ])("accepts a manifest whose range includes the host: %s", (enginesPstdio) => {
    expect(checkExtensionApiVersions(manifest(enginesPstdio), HOST_VERSION)).toEqual([]);
  });

  test.each(["^0.3.0", "^0.4.4"])("names a manifest the host would refuse: %s", (enginesPstdio) => {
    const errors = checkExtensionApiVersions(manifest(enginesPstdio), HOST_VERSION);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("extensions/planner/package.json");
    expect(errors[0]).toContain(enginesPstdio);
    expect(errors[0]).toContain(HOST_VERSION);
  });

  test.each([
    HOST_VERSION,
    "*",
    "^0.4.0 || *",
    "1.0.0-alpha.14",
  ])("rejects a declaration that is not caret terms: %s", (enginesPstdio) => {
    expect(checkExtensionApiVersions(manifest(enginesPstdio), HOST_VERSION)).toHaveLength(1);
  });
});

describe("readExtensionManifests", () => {
  test("reads engines.pstdio and skips manifests without it", () => {
    const root = mkdtempSync(join(tmpdir(), "extension-api-version-"));

    const write = (dir: string, enginesPstdio: string | null) => {
      mkdirSync(join(root, dir), { recursive: true });
      const engines = enginesPstdio ? { engines: { pstdio: enginesPstdio } } : {};
      writeFileSync(join(root, dir, "package.json"), JSON.stringify({ name: dir, ...engines }));
      return join(dir, "package.json");
    };

    const files = [
      write("extensions/planner", `^${HOST_VERSION}`),
      write(".pstdio/extensions/dev", "^0.3.0"),
      write("packages/ui", null),
    ];

    try {
      expect(readExtensionManifests(root, files)).toEqual([
        { file: join("extensions", "planner", "package.json"), enginesPstdio: `^${HOST_VERSION}` },
        { file: join(".pstdio", "extensions", "dev", "package.json"), enginesPstdio: "^0.3.0" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
