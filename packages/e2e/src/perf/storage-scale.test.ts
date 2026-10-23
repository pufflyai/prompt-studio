import { expect, test } from "bun:test";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScaleLayerCase } from "./storage-scale";

const runController = async (code: string) => {
  const root = mkdtempSync(join(tmpdir(), "database-layer-controller-"));
  const output = join(root, "stdout.jsonl");
  const errors = join(root, "stderr.log");
  const stdout = openSync(output, "w");
  const stderr = openSync(errors, "w");
  const events: object[] = [];
  try {
    let failure: unknown;
    try {
      await runScaleLayerCase("database", {
        name: "database-controller",
        command: process.execPath,
        args: ["--eval", code],
        stdout,
        stderr,
        emit: (event) => events.push(event),
      });
    } catch (error) {
      failure = error;
    }
    return { failure, output: readFileSync(output, "utf8"), errors: readFileSync(errors, "utf8"), events };
  } finally {
    closeSync(stdout);
    closeSync(stderr);
    rmSync(root, { recursive: true, force: true });
  }
};

test("database preparation delegates watchdog ownership and preserves child logs", async () => {
  const result = await runController(`
    console.log(JSON.stringify({ supervised: process.env.PSTDIO_SCALE_SUPERVISOR_PID === String(process.ppid) }));
    console.error("preparation diagnostics");
  `);
  expect(result.failure).toBeUndefined();
  expect(JSON.parse(result.output)).toEqual({ supervised: false });
  expect(result.errors).toContain("preparation diagnostics");
  expect(result.events).toEqual([]);
});

test("database preparation failure propagates without reporting a completed sample", async () => {
  const result = await runController('console.error("fixture verification failed"); process.exit(7);');
  expect(result.failure).toBeInstanceOf(Error);
  expect(String(result.failure)).toContain("7");
  expect(result.errors).toContain("fixture verification failed");
  expect(result.events).toEqual([]);
});

test("a terminated database controller cannot report success", async () => {
  const result = await runController('process.kill(process.pid, "SIGTERM");');
  expect(result.failure).toBeInstanceOf(Error);
  expect(String(result.failure)).toContain("SIGTERM");
  expect(result.events).toEqual([]);
});
