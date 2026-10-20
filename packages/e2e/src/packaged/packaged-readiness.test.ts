import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForPackagedReady } from "./packaged-serve-helpers";

test("packaged readiness reports an early child exit and its output", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-readiness-"));
  // Let the diagnostic reach its pipe before the fixture exits.
  const child = spawn("bun", ["-e", "console.error('migration failed'); process.exitCode = 7"], { stdio: "pipe" });
  try {
    const failure = await waitForPackagedReady(join(root, "runtime.json"), child).catch((error: unknown) => error);
    expect(failure).toMatchObject({ message: expect.stringMatching(/exited.*7[\s\S]*migration failed/) });
  } finally {
    child.kill();
    rmSync(root, { recursive: true, force: true });
  }
}, 1_000);
