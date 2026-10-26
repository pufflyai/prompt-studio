import { expect, test } from "bun:test";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finalizeBenchmarkCase, runBenchmarkCase } from "./benchmark-case";

// A killed process can briefly remain as a zombie (Z) or, on macOS, while it exits (E).
const expectStopped = (pid: number) => {
  if (process.platform === "win32") return expect(() => process.kill(pid, 0)).toThrow();
  const state = Bun.spawnSync(["ps", "-o", "stat=", "-p", String(pid)])
    .stdout.toString()
    .trim();
  expect(state === "" || /^[ZX]/.test(state) || state.includes("E")).toBe(true);
};

const run = async (mode: string, timeoutMs = 500) => {
  const root = mkdtempSync(join(tmpdir(), "bounded-benchmark-"));
  const output = join(root, "partial.jsonl");
  const fd = openSync(output, "a");
  const stderr = openSync(join(root, "stderr.log"), "a");
  const events: object[] = [];
  try {
    const result = await runBenchmarkCase({
      name: mode,
      command: process.execPath,
      args: [join(import.meta.dirname, "benchmark-case.fixture.ts"), mode],
      timeoutMs,
      stdout: fd,
      stderr,
      emit: (event) => events.push(event),
    });
    return { result, events, partial: readFileSync(output, "utf8") };
  } finally {
    closeSync(fd);
    closeSync(stderr);
    rmSync(root, { recursive: true, force: true });
  }
};

test("external deadline interrupts synchronous work and retains completed phases", async () => {
  const { result, events, partial } = await run("blocked");
  expect(partial).toContain('"phase":"setup-complete"');
  expect(result).toMatchObject({ status: "timed-out", passed: false, complete: false, limitMs: 500 });
  expect(result).not.toHaveProperty("durationMs");
  expect(events.at(-1)).toMatchObject({ phase: "case-end", status: "timed-out" });
  expect(result.elapsedWallMs).toBeLessThan(2_000);
});

test("progress cannot reset an absolute case deadline", async () => {
  const { result, partial } = await run("progress");
  expect(partial.split("\n").length).toBeGreaterThan(2);
  expect(result.status).toBe("timed-out");
  expect(result.elapsedWallMs).toBeLessThan(2_000);
});

test("timeout terminates owned descendants including a separate process group", async () => {
  const { result, partial } = await run("descendants", 1_000);
  expect(result.status).toBe("timed-out");
  const { pids } = JSON.parse(partial.trim());
  for (const pid of pids) expectStopped(pid);
});

test("normal exit and nonzero exit remain distinct from timeout", async () => {
  expect((await run("success", 1_000)).result).toMatchObject({ status: "completed", complete: true, exitCode: 0 });
  expect((await run("failure", 1_000)).result).toMatchObject({ status: "failed", passed: false, exitCode: 1 });
});

for (const mode of ["exit-with-descendants", "fail-with-descendants"])
  test(`${mode} cannot leave a detached descendant running`, async () => {
    const { result, partial } = await run(mode, 1_000);
    const { pids } = JSON.parse(partial.trim());
    try {
      expect(result.status).toBe(mode === "exit-with-descendants" ? "completed" : "failed");
      for (const pid of pids) expectStopped(pid);
    } finally {
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }
  });

test("a tighter allowance is retained and the maximum cannot exceed sixty seconds", async () => {
  expect((await run("blocked", 80)).result).toMatchObject({ limitMs: 80, status: "timed-out" });
  expect((await run("success", 90_000)).result.limitMs).toBe(60_000);
});

test("setup that never reaches an operation is bounded too", async () => {
  const { result, partial } = await run("setup");
  expect(result.status).toBe("timed-out");
  expect(partial).toContain('"phase":"setup-start"');
  expect(partial).not.toContain("operation");
});

test("an exit without completion and cleanup assurance cannot pass", async () => {
  const { result } = await run("unexpected-exit", 1_000);
  expect(result).toMatchObject({ status: "failed", complete: false, passed: false, completionReceived: false });
  expect(result.cleanupErrors).toContain(
    "Worker exited without completion handshake; detached-child cleanup is unverified",
  );
});

test("unobserved worker termination cannot pass after a completion message", () => {
  const outcome = finalizeBenchmarkCase({
    status: "completed",
    completionReceived: true,
    cleanupErrors: [],
    error: "Owned worker exit not observed",
    elapsedWallMs: 200,
    limitMs: 500,
  });
  expect(outcome).toMatchObject({ status: "failed", complete: false, passed: false });
  expect(outcome.cleanupErrors).toContain("Owned worker exit not observed");
});

test("cleanup that crosses the cap cannot produce an over-cap success", () => {
  expect(
    finalizeBenchmarkCase({
      status: "completed",
      completionReceived: true,
      cleanupErrors: [],
      elapsedWallMs: 501,
      limitMs: 500,
    }),
  ).toMatchObject({ status: "timed-out", complete: false, passed: false });
});
