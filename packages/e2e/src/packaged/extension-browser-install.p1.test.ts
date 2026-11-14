import { beforeAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logTestPhase } from "../scripts/log-test-phase";
import { runTestCommand } from "../scripts/run-test-command";
import { writeSmokeExtension } from "./extension-smoke-fixtures";
import { buildBinary, PACKAGED_BINARY_PATH } from "./packaged-helpers";

beforeAll(buildBinary, 180_000);

test("a missing Playwright install is a setup error with browser setup instructions", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-browser-missing-"));
  try {
    const source = writeSmokeExtension(root);
    logTestPhase("run extension smoke with missing Playwright");
    const run = await runTestCommand(
      PACKAGED_BINARY_PATH,
      ["extensions", "test", source, "--json"],
      {
        cwd: root,
        env: { ...process.env, PSTDIO_HOME: join(root, "home") },
      },
      3,
    );
    expect(run.status).toBe(3);
    expect(JSON.parse(run.stdout).checks).toContainEqual(
      expect.objectContaining({
        id: "setup",
        phase: "setup",
        status: "failed",
        message: expect.stringContaining("pst extensions install-browser"),
      }),
    );
    expect(existsSync(join(root, "home", "runtime.json"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
