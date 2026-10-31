import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startNativePerformanceCapture } from "pstdio/performance";
import {
  createPerformanceRecording,
  readPerformanceRecordings,
  restoreRecordedCapture,
  summarizePerformanceEvidence,
} from "pstdio-diagnostics";
import { PACKAGED_BINARY_PATH } from "../packaged/packaged-helpers";
import type { PackagedRuntimeObservation } from "../packaged/packaged-serve-helpers";
import { configuredContainer, readContainerProcess } from "./storage-scale-container";
import { type ScaleRuntime, startScaleRuntime } from "./storage-scale-runtime";

/** Each measured runtime uses the same bounded collector and evidence format as desktop. */
export const createObservedScaleRuntime = (root: string, emit: (row: object) => void) => {
  const failures: string[] = [];
  const hostVersion = execFileSync(PACKAGED_BINARY_PATH, ["--version"], { encoding: "utf8" }).trim();
  const start = async (home: string, environment: Record<string, string> = {}) => {
    const name = `performance-${randomUUID()}`;
    const directory = join(root, name);
    const recorder = createPerformanceRecording(directory);
    const container = configuredContainer(home);
    let runtime: ScaleRuntime | undefined;
    let observed: PackagedRuntimeObservation | undefined;
    const onError = (error: unknown) => failures.push(`Performance sampling failed: ${String(error)}`);
    const capture = await startNativePerformanceCapture({
      hostVersion,
      // A container runtime is measured inside its own PID namespace, never through a host process.
      readProcess: container ? (pid) => readContainerProcess(container, pid) : undefined,
      backend: () => {
        if (observed)
          return {
            id: observed.descriptor?.instanceId ?? null,
            pid: observed.pid,
            origin: observed.descriptor?.origin ?? null,
            token: observed.descriptor?.token ?? null,
            scope: "local",
          };
        return runtime
          ? {
              id: runtime.descriptor.instanceId,
              pid: runtime.descriptor.pid,
              origin: runtime.baseUrl,
              token: runtime.descriptor.token,
              scope: "local",
            }
          : null;
      },
      record: (captureId, sample) => recorder.write({ kind: "sample", captureId, sample }),
      onError,
    }).catch((error) => {
      recorder.close();
      throw error;
    });
    let finishing: Promise<void> | undefined;
    const finish = (reason: "completed" | "crashed" | "failed") =>
      (finishing ??= (async () => {
        const operationEndedAt = Date.now();
        try {
          if (reason === "completed")
            await new Promise((resolve) => setTimeout(resolve, capture.snapshot().sampleIntervalMs));
          await capture.sample();
          const evidence = restoreRecordedCapture(readPerformanceRecordings(directory), capture.snapshot());
          const summary = summarizePerformanceEvidence(evidence, ["backend"], operationEndedAt);
          failures.push(...summary.failures);
          const file = `${name}.json`;
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, file), JSON.stringify({ reason, summary, capture: evidence }));
          emit({ phase: "performance-capture", file, reason, summary, containerId: container?.containerId ?? null });
        } finally {
          recorder.close();
          await capture.close();
        }
      })());
    try {
      runtime = await startScaleRuntime(home, environment, (process) => {
        observed = process;
        void capture.sample().catch(onError);
      });
      await capture.sample();
      return {
        ...runtime,
        stop: async () => {
          try {
            await finish("completed");
          } finally {
            await runtime!.stop();
          }
        },
        // Preserve the workload's immediate kill boundary; missing exit readings remain coverage failures.
        crash: async () => {
          try {
            await runtime!.crash();
          } finally {
            await finish("crashed");
          }
        },
      };
    } catch (error) {
      try {
        await finish("failed");
      } finally {
        await runtime?.stop();
      }
      throw error;
    }
  };
  return { start, failures };
};
