import { beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, runPackagedSafe } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;

beforeAll(() => {
  buildBinary();
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

// Regression: a Bun --compiled binary cannot resolve an externally imported extension's
// on-disk node_modules, so loading any extension that imports a bare dependency used to
// fail with a ResolveMessage. The loader now bundles the entry before importing it.
const writeExtensionWithDependency = (home: string) => {
  const extDir = join(home, "extensions", "dep-ext");
  const depDist = join(extDir, "node_modules", "test-dep", "dist");
  mkdirSync(depDist, { recursive: true });

  // The dependency exposes its entry only through an `exports` subpath (like
  // `@pstdio/sdk/extensions`); a compiled binary's resolver ignores that map for an
  // externally imported file, which is the exact shape that broke extension loading.
  writeFileSync(
    join(extDir, "node_modules", "test-dep", "package.json"),
    JSON.stringify({
      name: "test-dep",
      version: "1.0.0",
      type: "module",
      exports: { "./feature": "./dist/feature.js" },
    }),
  );
  writeFileSync(join(depDist, "feature.js"), 'export const marker = "loaded-via-exports-subpath";\n');

  writeFileSync(
    join(extDir, "package.json"),
    JSON.stringify({
      name: "dep-ext",
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: "*" },
      dependencies: { "test-dep": "1.0.0" },
    }),
  );
  writeFileSync(
    join(extDir, "extension.ts"),
    'import { marker } from "test-dep/feature";\nif (typeof marker !== "string") throw new Error("dependency not loaded");\nexport default { skills: {} };\n',
  );
};

describe("packaged pstdio — extension dependency loading", () => {
  test(
    "loads an installed extension that imports an on-disk node_modules dependency",
    () => {
      const home = mkdtempSync(join(tmpdir(), "pstdio-ext-home-"));
      try {
        writeExtensionWithDependency(home);

        const result = runPackagedSafe("extensions check --json", home, { PSTDIO_HOME: home });
        const payload = JSON.parse(result.stdout);
        const checks: Array<{
          errorCount: number;
          diagnostics: Array<{ code: string }>;
          extensions: Array<{ name: string }>;
        }> = payload.checks ?? [payload];

        const importFailure = checks
          .flatMap((check) => check.diagnostics)
          .find((diagnostic) => diagnostic.code === "extension_import_failed");
        expect(importFailure).toBeUndefined();
        expect(checks.reduce((total, check) => total + check.errorCount, 0)).toBe(0);
        expect(checks.flatMap((check) => check.extensions).map((extension) => extension.name)).toContain("dep-ext");
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );
});
