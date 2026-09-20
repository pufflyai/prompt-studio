import { test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBunScenario } from "../../test-utils/run-bun-scenario";

// Windows uses one native recursive watcher and does not scan dependency directories.
test.skipIf(process.platform === "win32")("keeps watching when dependencies disappear during refresh", async () => {
  const source = mkdtempSync(join(tmpdir(), "extension-dependency-removal-"));
  try {
    await runBunScenario(join(import.meta.dirname, "extension-source-watcher-removal.fixture.ts"), ["watch", source]);
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});
