import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkExtensionApiVersions, readExtensionManifests } from "./verify-extension-api-version";

const HOST_VERSION = "1.0.0-alpha.1";

describe("checkExtensionApiVersions", () => {
  test("accepts manifests declaring the host version", () => {
    const errors = checkExtensionApiVersions(
      [
        { file: "extensions/planner/package.json", enginesPstdio: HOST_VERSION },
        { file: ".pstdio/extensions/dev/package.json", enginesPstdio: HOST_VERSION },
      ],
      HOST_VERSION,
    );

    expect(errors).toEqual([]);
  });

  test("catches a manifest left on the previous alpha", () => {
    const errors = checkExtensionApiVersions(
      [{ file: "extensions/planner/package.json", enginesPstdio: "1.0.0-alpha.0" }],
      HOST_VERSION,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("extensions/planner/package.json");
    expect(errors[0]).toContain("1.0.0-alpha.0");
    expect(errors[0]).toContain(HOST_VERSION);
  });

  test("catches a range", () => {
    const errors = checkExtensionApiVersions(
      [{ file: "extensions/planner/package.json", enginesPstdio: `^${HOST_VERSION}` }],
      HOST_VERSION,
    );

    expect(errors).toHaveLength(1);
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
      write("extensions/planner", HOST_VERSION),
      write(".pstdio/extensions/dev", "1.0.0-alpha.0"),
      write("packages/ui", null),
    ];

    try {
      expect(readExtensionManifests(root, files)).toEqual([
        { file: "extensions/planner/package.json", enginesPstdio: HOST_VERSION },
        { file: ".pstdio/extensions/dev/package.json", enginesPstdio: "1.0.0-alpha.0" },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
