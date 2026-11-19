import type { Profiler, Session } from "node:inspector";
import { setTimeout as delay } from "node:timers/promises";
import { createCheckpointWriter } from "./checkpoint-writer";
import { frequentFunctions } from "./functions";
import { post, withProfiler } from "./inspector";
import { collectOperationTrace } from "./operation-trace";

interface CpuReading {
  capturedAt: string;
  intervalMs: number;
  cpuPercent: number;
}

interface ProfileWindow {
  startedAt: string;
  finishedAt: string;
  profile: Profiler.Profile;
}

export interface ArmedCaptureData {
  kind: "cpu";
  mode: "armed";
  pid: number;
  runtime: { bunVersion: string; platform: string; architecture: string };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  complete: boolean;
  reason: "recording" | "threshold" | "expired";
  thresholdCpuPercent: number;
  trigger?: CpuReading;
  cpu: CpuReading[];
  profiles: ProfileWindow[];
  discardedProfileWindows: number;
  skippedCheckpoints: number;
  operations: ReturnType<ReturnType<typeof collectOperationTrace>["snapshot"]>;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
}

interface ArmedProfileInput {
  id: string;
  durationMs: number;
  thresholdCpuPercent: number;
  signal?: AbortSignal;
  checkpoint: (data: ArmedCaptureData) => Promise<void>;
  windowMs?: number;
  sampleIntervalMs?: number;
}

const collectCpuReadings = (intervalMs: number) => {
  const readings: CpuReading[] = [];
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
  let reason: ArmedCaptureData["reason"] = "recording";
  let trigger: CpuReading | undefined;
  do {
    const remaining = input.durationMs - (performance.now() - watchStarted);
    const windowRemaining = windowMs - (performance.now() - started);
    const untilCpuSample = cpu.nextSampleAt() - performance.now();
    await delay(Math.max(1, Math.min(untilCpuSample, remaining, windowRemaining)), undefined, { signal: input.signal });
    input.signal?.throwIfAborted();
    const reading = cpu.sample();
    if (reading && reading.cpuPercent >= input.thresholdCpuPercent) {
      trigger = reading;
      reason = "threshold";
    } else if (performance.now() - watchStarted >= input.durationMs) reason = "expired";
  } while (reason === "recording" && performance.now() - started < windowMs);
  const { profile } = await post<Profiler.StopReturnType>(session, "Profiler.stop");
  return { reason, trigger, window: { startedAt, finishedAt: new Date().toISOString(), profile } };
};

export const captureArmedProfile = (input: ArmedProfileInput) =>
  withProfiler(input.id, async (session) => {
    input.signal?.throwIfAborted();
    const trace = collectOperationTrace();
    const lifetime = new AbortController();
    const signal = input.signal ? AbortSignal.any([input.signal, lifetime.signal]) : lifetime.signal;
    let checkpointFailure: { error: unknown } | undefined;
    const checkpoints = createCheckpointWriter(input.checkpoint, (error) => {
      checkpointFailure = { error };
      lifetime.abort(error);
    });
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const memoryBefore = process.memoryUsage();
    const cpu = collectCpuReadings(input.sampleIntervalMs ?? 2000);
    const profiles: ProfileWindow[] = [];
    let discardedProfileWindows = 0;
    let trigger: CpuReading | undefined;
    let reason: ArmedCaptureData["reason"] = "recording";
    let result: ArmedCaptureData | undefined;
    try {
      let window = await startWindow(session);
      while (reason === "recording") {
        const recorded = await recordWindow(session, { ...input, signal }, started, cpu, window);
        reason = recorded.reason;
        trigger = recorded.trigger;
        profiles.push(recorded.window);
        if (profiles.length > 2) {
          profiles.shift();
          discardedProfileWindows++;
        }
        // Keep sampling while checkpoint serialization and I/O run, so the next CPU interval has stacks.
        if (reason === "recording") window = await startWindow(session);
        result = {
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
        // Completed windows survive process termination. Atomic replacement keeps the prior window on write failure.
        result.skippedCheckpoints = checkpoints.queue(result);
      }
      await checkpoints.flush(signal);
      const latest = result!;
      return {
        data: latest,
        summary: {
          durationMs: latest.durationMs,
          unit: "samples" as const,
          ...frequentFunctions(profiles.map((window) => window.profile)),
          memoryBefore,
          memoryAfter: latest.memoryAfter,
        },
      };
    } catch (error) {
      if (checkpointFailure) throw checkpointFailure.error;
      throw error;
    } finally {
      lifetime.abort();
      checkpoints.stop();
      trace.close();
    }
  });
