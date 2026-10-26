import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";

export interface TimingWindowInput {
  sessionId: string;
  requiredPeers: string[];
  acknowledgements: { sessionId: string; evidence: string }[];
  purpose: string;
  isolatedRunnerEvidence?: string;
}

export interface TimingWindow extends TimingWindowInput {
  token: string;
  hostname: string;
  acquiredAt: string;
}

export const acquireTimingWindow = (path: string, input: TimingWindowInput) => {
  if (!input.sessionId.trim() || !input.purpose.trim()) throw new Error("Missing timing window owner or purpose");
  const missing = input.requiredPeers.filter(
    (peer) => !input.acknowledgements.some((ack) => ack.sessionId === peer && ack.evidence.trim().length > 0),
  );
  if (missing.length) throw new Error(`Missing explicit pause acknowledgements: ${missing.join(", ")}`);
  if (!input.requiredPeers.length && !input.isolatedRunnerEvidence?.trim())
    throw new Error("A runner with no peers needs explicit isolation evidence");
  const lease: TimingWindow = {
    ...input,
    token: randomUUID(),
    hostname: hostname(),
    acquiredAt: new Date().toISOString(),
  };
  // Atomic across worktrees. An abandoned directory stays locked until its owner is reconciled.
  mkdirSync(path);
  try {
    writeFileSync(join(path, "owner.json"), JSON.stringify(lease, null, 2), { flag: "wx" });
  } catch (error) {
    rmdirSync(path);
    throw error;
  }
  return lease;
};

export const readTimingWindow = (path: string) =>
  JSON.parse(readFileSync(join(path, "owner.json"), "utf8")) as TimingWindow;

export const assertTimingWindow = (path: string, sessionId: string, token: string) => {
  const lease = readTimingWindow(path);
  if (lease.sessionId !== sessionId) throw new Error(`Timing window belongs to owner ${lease.sessionId}`);
  if (lease.token !== token) throw new Error("Timing window token changed");
  if (lease.hostname !== hostname()) throw new Error("Timing window belongs to another machine");
  return lease;
};

export const releaseTimingWindow = (path: string, sessionId: string, token: string) => {
  const lease = assertTimingWindow(path, sessionId, token);
  unlinkSync(join(path, "owner.json"));
  rmdirSync(path);
  return { ...lease, releasedAt: new Date().toISOString() };
};

export const assertMeasurementWindow = () => {
  const sessionId = process.env.PSTDIO_TIMING_SESSION_ID;
  const token = process.env.PSTDIO_TIMING_TOKEN;
  if (!sessionId || !token) throw new Error("Measured work needs an acknowledged exclusive timing window");
  return assertTimingWindow(
    process.env.PSTDIO_TIMING_LOCK_DIR ?? join(tmpdir(), "pstdio-exclusive-timing.lock"),
    sessionId,
    token,
  );
};
