import type { Session } from "node:inspector";
import type {
  BackendArmedCaptureData,
  BackendCpuProfile,
  BackendCpuReading,
  BackendDiagnosticSummary,
} from "pstdio-api-contracts/extension-kernel";
import { createCheckpointWriter } from "./checkpoint-writer";
import { frequentFunctions } from "./functions";
import { diagnosticsError, post, wait, withProfiler } from "./inspector";
import { collectOperationTrace } from "./operation-trace";

type ProfileWindow = BackendArmedCaptureData["profiles"][number];

export interface ArmedProfileInput {
  durationMs: number;
  thresholdCpuPercent: number;
  signal?: AbortSignal;
  checkpoint?: (data: BackendArmedCaptureData) => Promise<void> | void;
  windowMs?: number;
  sampleIntervalMs?: number;
  checkpointTimeoutMs?: number;
}

const collectCpuReadings = (intervalMs: number) => {
  const readings: BackendCpuReading[] = [];
  let previousCpu = process.cpuUsage();
  let previousTime = performance.now();
  return {
    readings,
    nextSampleAt: () => previousTime + intervalMs,
    sample() {
      const now = performance.now();
      if (now - previousTime < intervalMs) return;
      const usage = process.cpuUsage();
      const observedIntervalMs = now - previousTime;
      const cpuPercent =
        ((usage.user - previousCpu.user + usage.system - previousCpu.system) / (observedIntervalMs * 1000)) * 100;
      const reading = { capturedAt: new Date().toISOString(), intervalMs: observedIntervalMs, cpuPercent };
      readings.push(reading);
      if (readings.length > 64) readings.shift();
      previousCpu = usage;
      previousTime = now;
      return reading;
    },
  };
};

const startWindow = async (session: Session) => {
  await post(session, "Profiler.start");
  return { startedAt: new Date().toISOString(), started: performance.now() };
};

const recordWindow = async (
  session: Session,
  input: ArmedProfileInput,
  watchStarted: number,
  cpu: ReturnType<typeof collectCpuReadings>,
  window: Awaited<ReturnType<typeof startWindow>>,
) => {
  const { startedAt, started } = window;
  const windowMs = input.windowMs ?? 30_000;
  let reason: BackendArmedCaptureData["reason"] = "recording";
  let trigger: BackendCpuReading | undefined;
  do {
    const remaining = input.durationMs - (performance.now() - watchStarted);
    const windowRemaining = windowMs - (performance.now() - started);
    const untilCpuSample = cpu.nextSampleAt() - performance.now();
    await wait(Math.max(1, Math.min(untilCpuSample, remaining, windowRemaining)), input.signal);
    input.signal?.throwIfAborted();
    const reading = cpu.sample();
    if (reading && reading.cpuPercent >= input.thresholdCpuPercent) {
      trigger = reading;
      reason = "threshold";
    } else if (performance.now() - watchStarted >= input.durationMs) reason = "expired";
  } while (reason === "recording" && performance.now() - started < windowMs);
  const { profile } = await post<{ profile: BackendCpuProfile }>(session, "Profiler.stop");
  return { reason, trigger, window: { startedAt, finishedAt: new Date().toISOString(), profile } };
};

/** Profiles in windows until CPU reaches the threshold or the watch expires. Keeps the latest two windows. */
const FINAL_CHECKPOINT_TIMEOUT_MS = 30_000;

export const captureArmedProfile = async (input: ArmedProfileInput) => {
  input.signal?.throwIfAborted();
  const lifetime = new AbortController();
  const signal = input.signal ? AbortSignal.any([input.signal, lifetime.signal]) : lifetime.signal;
  let checkpointFailure: { error: unknown } | undefined;
  const write = input.checkpoint;
  const checkpoints = createCheckpointWriter<BackendArmedCaptureData>(
    async (data) => {
      await write?.(data);
    },
    (error) => {
      checkpointFailure = { error };
      lifetime.abort(error);
    },
  );
  try {
    const result = await withProfiler(async (session) => {
      signal.throwIfAborted();
      const trace = collectOperationTrace();
      const startedAt = new Date().toISOString();
      const started = performance.now();
      const memoryBefore = process.memoryUsage();
      const cpu = collectCpuReadings(input.sampleIntervalMs ?? 2000);
      const profiles: ProfileWindow[] = [];
      let discardedProfileWindows = 0;
      try {
        let window = await startWindow(session);
        for (;;) {
          const recorded = await recordWindow(session, { ...input, signal }, started, cpu, window);
          const { reason, trigger } = recorded;
          profiles.push(recorded.window);
          if (profiles.length > 2) {
            profiles.shift();
            discardedProfileWindows++;
          }
          // Sample checkpoint serialization and I/O in the next window while watching.
          if (reason === "recording") window = await startWindow(session);
          const data: BackendArmedCaptureData = {
            kind: "cpu",
            mode: "armed",
            pid: process.pid,
            runtime: { bunVersion: Bun.version, platform: process.platform, architecture: process.arch },
            startedAt,
            finishedAt: new Date().toISOString(),
            durationMs: Math.round(performance.now() - started),
            complete: reason !== "recording",
            reason,
            thresholdCpuPercent: input.thresholdCpuPercent,
            trigger,
            cpu: [...cpu.readings],
            profiles: [...profiles],
            discardedProfileWindows,
            skippedCheckpoints: 0,
            operations: trace.snapshot(),
            memoryBefore,
            memoryAfter: process.memoryUsage(),
          };
          if (data.complete) {
            const summary: BackendDiagnosticSummary = {
              durationMs: data.durationMs,
              unit: "samples",
              ...frequentFunctions(profiles.map((entry) => entry.profile)),
              memoryBefore,
              memoryAfter: data.memoryAfter,
            };
            return { data, summary };
          }
          if (write) checkpoints.queue(data);
        }
      } finally {
        trace.close();
      }
    });
    signal.throwIfAborted();
    if (write) {
      // The recording is complete. A slow final write must not own the shared inspector or trace.
      const timeout = setTimeout(
        () =>
          lifetime.abort(
            diagnosticsError("diagnostics_checkpoint_timeout", "The final checkpoint writes did not finish."),
          ),
        input.checkpointTimeoutMs ?? FINAL_CHECKPOINT_TIMEOUT_MS,
      );
      try {
        checkpoints.queue(result.data);
        await checkpoints.flush(signal);
      } finally {
        clearTimeout(timeout);
      }
    }
    return result;
  } catch (error) {
    input.signal?.throwIfAborted();
    if (checkpointFailure) throw checkpointFailure.error;
    throw error;
  } finally {
    lifetime.abort();
    checkpoints.stop();
  }
};
