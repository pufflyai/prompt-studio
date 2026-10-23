import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { runBenchmarkCase } from "./benchmark-case";
import { fixtureVersion, type Workload, workload } from "./fixture";

export interface PreparedFixtureIdentity {
  format: string;
  kind: Workload;
  count: number;
  churn: boolean;
}
export interface FixtureVerification {
  records: number;
  seedCommits: number;
}
const marker = "fixture-complete.json";
const expectedCommits = (identity: PreparedFixtureIdentity) =>
  Math.ceil(identity.count / workload(identity.kind).seedBatchRows) * (identity.churn ? 9 : 4);
const validateVerification = (value: FixtureVerification, identity: PreparedFixtureIdentity) => {
  assert.equal(value.records, identity.count, "Prepared fixture row count differs");
  assert.equal(value.seedCommits, expectedCommits(identity), "Prepared fixture history is incomplete");
};
interface PreparationResult {
  verification: FixtureVerification;
  preparation: { pid: number; durationMs: number; maxRssBytes: number };
}

export const isFixturePreparationWorker = () => process.env.PSTDIO_SCALE_PREPARATION_PID === String(process.ppid);
export const completeFixturePreparation = async (run: () => Promise<FixtureVerification>) => {
  assert(isFixturePreparationWorker() && process.send, "Preparation requires its controller");
  const started = performance.now();
  // run must return only after verification and all service/database cleanup.
  const verification = await run();
  process.send({
    fixturePrepared: {
      verification,
      preparation: {
        pid: process.pid,
        durationMs: performance.now() - started,
        maxRssBytes: process.resourceUsage().maxRSS * 1024,
      },
    },
  });
  process.disconnect?.();
};

export const runFixturePreparation = async (input: {
  root: string;
  identity: PreparedFixtureIdentity;
  command: string;
  args: string[];
  cwd?: string;
  stdout?: number;
  stderr?: number;
  emit: (event: object) => void;
}) => {
  const root = resolve(input.root);
  mkdirSync(dirname(root), { recursive: true });
  // A failed or previous preparation is evidence, never an input to a fresh one.
  mkdirSync(root);
  input.emit({
    phase: "fixture-preparation-start",
    identity: input.identity,
    boundary: "unmeasured-preparation-process",
    acceptedTiming: false,
  });
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: { ...process.env, PSTDIO_SCALE_PREPARATION_PID: String(process.pid) },
    detached: process.platform !== "win32",
    stdio: ["ignore", input.stdout ?? "inherit", input.stderr ?? "inherit", "ipc"],
  });
  let prepared: PreparationResult | undefined;
  child.on("message", (message) => {
    if (typeof message === "object" && message !== null && "fixturePrepared" in message)
      prepared = message.fixturePrepared as PreparationResult;
  });
  const abort = () => {
    if (!child.pid) return;
    if (process.platform === "win32") child.kill("SIGKILL");
    else
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
  };
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    const code = await new Promise<number | null>((done, reject) => {
      child.once("error", reject);
      child.once("exit", done);
    });
    assert.equal(code, 0, "Fixture preparation did not exit successfully");
    assert(prepared, "Fixture preparation exited without verification");
    assert.equal(prepared.preparation.pid, child.pid, "Preparation result belongs to another process");
    validateVerification(prepared.verification, input.identity);
    const manifest = { version: fixtureVersion, identity: input.identity, ...prepared };
    // Child exit guarantees no preparation service, database or worker can still mutate this fixture.
    writeFileSync(join(root, marker), JSON.stringify(manifest));
    input.emit({ phase: "fixture-preparation-complete", ...manifest, acceptedTiming: false });
    return manifest;
  } finally {
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
  }
};

export const readPreparedFixture = (root: string, identity: PreparedFixtureIdentity) => {
  const value = JSON.parse(readFileSync(join(root, marker), "utf8"));
  assert.equal(value.version, fixtureVersion, "Prepared fixture version differs");
  assert.deepEqual(value.identity, identity, "Prepared fixture workload or format differs");
  validateVerification(value.verification, identity);
  return value as { version: string; identity: PreparedFixtureIdentity } & PreparationResult;
};

export const runPreparedSample = async (
  input: Parameters<typeof runBenchmarkCase>[0] & {
    snapshot: string;
    root: string;
    identity: PreparedFixtureIdentity;
  },
) => {
  const snapshot = resolve(input.snapshot);
  const root = resolve(input.root);
  assert(
    snapshot !== root && !snapshot.startsWith(root + sep) && !root.startsWith(snapshot + sep),
    "Sample and fixture paths must not overlap",
  );
  const fixture = readPreparedFixture(snapshot, input.identity);
  assert(!existsSync(root), "Sample destination must be fresh; preserve previous evidence");
  const started = performance.now();
  input.emit({
    phase: "fixture-copy-start",
    snapshot,
    root,
    preparationPid: fixture.preparation.pid,
    acceptedTiming: false,
  });
  // Even an interrupted copy must never look like a verified preparation.
  cpSync(snapshot, root, { recursive: true, filter: (source) => source !== join(snapshot, marker) });
  writeFileSync(join(root, "sample-provenance.json"), JSON.stringify(fixture));
  input.emit({
    phase: "fixture-copy-complete",
    durationMs: performance.now() - started,
    boundary: "controller-before-sample-spawn",
    acceptedTiming: false,
  });
  return runBenchmarkCase(input);
};
