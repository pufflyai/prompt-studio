import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { writeExtensionWithDependency } from "./extension-fixtures";
import { buildBinary, runPackagedSafe } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;

beforeAll(() => {
  buildBinary();
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

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
          warningCount: number;
          diagnostics: Array<{ code: string }>;
          extensions: Array<{ name: string }>;
          templates: Array<{ id: string }>;
        }> = payload.checks ?? [payload];

        const importFailure = checks
          .flatMap((check) => check.diagnostics)
          .find((diagnostic) => diagnostic.code === "extension_import_failed");
        expect(importFailure).toBeUndefined();
        expect(checks.reduce((total, check) => total + check.errorCount, 0)).toBe(0);
        expect(checks.reduce((total, check) => total + check.warningCount, 0)).toBe(0);
        expect(checks.flatMap((check) => check.extensions).map((extension) => extension.name)).toContain("dep-ext");
        expect(checks.flatMap((check) => check.templates).map((template) => template.id)).toContain(
          "test.dep-ext.template.packaged-asset",
        );
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    },
    TEST_TIMEOUT,
  );
});
