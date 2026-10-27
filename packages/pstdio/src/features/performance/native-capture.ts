import type { PerformanceCaptureSample } from "pstdio-api-contracts/performance-diagnostics";
import { type PerformanceBackend, PerformanceCaptureCollector } from "pstdio-diagnostics";
import { createProcessSampler } from "./process-sampler";

interface NativeCaptureInput {
  hostVersion: string;
  backend: () => PerformanceBackend | null;
  record?: (captureId: string, sample: PerformanceCaptureSample) => void;
  onError: (error: unknown) => void;
}

/** Explicit benchmark/CLI capture. The observed runtime owns none of this sampling work. */
export const startNativePerformanceCapture = async (input: NativeCaptureInput) => {
  let sampler: Awaited<ReturnType<typeof createProcessSampler>> | null = null;
  const capture = new PerformanceCaptureCollector({
    hostVersion: input.hostVersion,
    backend: input.backend,
    platform: process.platform,
    intervalMs: 2000,
    record: (sample) => input.record?.(capture.id, sample),
    readProcess: async (pid, signal) => {
      signal.throwIfAborted();
      sampler ??= await createProcessSampler();
      const reading = await sampler.read(pid);
      signal.throwIfAborted();
      return reading;
    },
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  const close = async () => {
    clearInterval(timer);
    capture.stop();
    try {
      await capture.flush([]);
    } finally {
      sampler?.close();
      sampler = null;
    }
  };
  try {
    await capture.sample([]);
    timer = setInterval(() => void capture.sample([]).catch(input.onError), 2000);
    return { sample: () => capture.flush([]), snapshot: () => capture.snapshot(), close };
  } catch (error) {
    await close();
    throw error;
  }
};
