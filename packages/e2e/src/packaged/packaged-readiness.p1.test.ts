import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPackagedServe, waitForPackagedReady } from "./packaged-serve-helpers";

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

test("cancelling packaged readiness stops its child and refuses a later runtime", async () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-readiness-cancel-"));
  // Bun runs this local entrypoint in place of a runtime that never becomes ready.
  writeFileSync(join(root, "serve"), "setInterval(() => {}, 1000)");
  const controller = new AbortController();
  const reason = new Error("Scenario ended");
  let pid: number | undefined;
  let laterAdmitted = false;
  try {
    await expect(
      startPackagedServe(
        root,
        {},
        process.execPath,
        (observation) => {
          pid = observation.pid;
          controller.abort(reason);
        },
        undefined,
        controller.signal,
      ),
    ).rejects.toThrow(/exited before readiness/);
    expect(typeof pid).toBe("number");
    expect(() => process.kill(pid!, 0)).toThrow();
    await expect(
      startPackagedServe(
        root,
        {},
        process.execPath,
        () => {
          laterAdmitted = true;
        },
        undefined,
        controller.signal,
      ),
    ).rejects.toBe(reason);
    expect(laterAdmitted).toBe(false);
  } finally {
    if (pid) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 5_000);
