import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runFixturePreparation, runPreparedSample } from "./prepared-fixture";

const identity = { format: "test-source", kind: "small" as const, count: 1000, churn: false };
const script = join(import.meta.dir, "prepared-fixture.fixture.ts");

test("only verified preparation that closes and exits can produce a sample fixture", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-fixture-"));
  try {
    for (const mode of ["seed-failure", "verify-failure", "close-failure"]) {
      const fixture = join(root, mode);
      const error = await runFixturePreparation({
        root: fixture,
        identity,
        command: process.execPath,
        args: [script, "prepare", fixture, mode],
        emit: () => {},
      }).catch((error) => error);
      expect(error).toBeInstanceOf(Error);
      expect(existsSync(join(fixture, "fixture-complete.json"))).toBe(false);
      const rejected = await runPreparedSample({
        snapshot: fixture,
        root: join(root, "sample"),
        identity,
        name: mode,
        command: process.execPath,
        args: [script, "sample", join(root, "sample")],
        emit: () => {},
      }).catch((error) => error);
      expect(rejected).toBeInstanceOf(Error);
      expect(existsSync(join(root, "sample"))).toBe(false);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("copy and verification precede a fresh supervised sample whose first storage access is a write", async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-sample-"));
  const fixture = join(root, "fixture");
  const sample = join(root, "sample");
  const events: object[] = [];
  try {
    const prepared = await runFixturePreparation({
      root: fixture,
      identity,
      command: process.execPath,
      args: [script, "prepare", fixture, "success"],
      emit: (event) => events.push(event),
    });
    expect(readFileSync(join(fixture, "closed"), "utf8")).toBe("yes");
    expect(prepared.preparation.pid).not.toBe(process.pid);
    const wrong = await runPreparedSample({
      snapshot: fixture,
      root: sample,
      identity: { ...identity, count: 10000 },
      name: "wrong",
      command: process.execPath,
      args: [script, "sample", sample],
      emit: () => {},
    }).catch((error) => error);
    expect(wrong).toBeInstanceOf(Error);
    const result = await runPreparedSample({
      snapshot: fixture,
      root: sample,
      identity,
      name: "sample",
      command: process.execPath,
      args: [script, "sample", sample],
      emit: (event) => events.push(event),
    });
    expect(result.complete).toBe(true);
    expect(result.limitMs).toBe(60000);
    expect(result.workerPid).not.toBe(prepared.preparation.pid);
    const observed = JSON.parse(readFileSync(join(sample, "sample-observed.json"), "utf8"));
    expect(observed).toMatchObject({
      firstAccess: "write",
      readBeforeWrite: false,
      preparedPid: prepared.preparation.pid,
    });
    const phases = events.map((event) => (event as { phase: string }).phase);
    expect(phases.indexOf("fixture-copy-complete")).toBeLessThan(phases.indexOf("case-start"));
    expect(JSON.parse(readFileSync(join(fixture, "state.json"), "utf8")).value).toBe("prepared");
    expect(JSON.parse(readFileSync(join(sample, "state.json"), "utf8")).value).toBe("edited");
    expect(prepared).not.toHaveProperty("limitMs");
    expect(existsSync(join(sample, "fixture-complete.json"))).toBe(false);
    for (const destination of [fixture, root, join(fixture, "inside"), sample]) {
      const error = await runPreparedSample({
        snapshot: fixture,
        root: destination,
        identity,
        name: "overlap",
        command: process.execPath,
        args: [script, "sample", destination],
        emit: () => {},
      }).catch((error) => error);
      expect(error).toBeInstanceOf(Error);
    }
    const reused = await runFixturePreparation({
      root: fixture,
      identity,
      command: process.execPath,
      args: [script, "prepare", fixture, "seed-failure"],
      emit: () => {},
    }).catch((error) => error);
    expect(reused).toBeInstanceOf(Error);
    const mutable = await runPreparedSample({
      snapshot: sample,
      root: join(root, "invalid-source"),
      identity,
      name: "mutable",
      command: process.execPath,
      args: [script, "sample", sample],
      emit: () => {},
    }).catch((error) => error);
    expect(mutable).toBeInstanceOf(Error);
    expect(JSON.parse(readFileSync(join(fixture, "state.json"), "utf8")).value).toBe("prepared");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
