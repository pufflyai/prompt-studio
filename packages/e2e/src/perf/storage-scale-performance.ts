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
import { configuredContainer } from "./storage-scale-container";
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
    const capture = await startNativePerformanceCapture({
      hostVersion,
      backend: () =>
        runtime
          ? {
              id: runtime.descriptor.instanceId,
              pid: container ? null : runtime.descriptor.pid,
              origin: runtime.baseUrl,
              token: runtime.descriptor.token,
              scope: container ? "remote" : "local",
            }
          : null,
      record: (captureId, sample) => recorder.write({ kind: "sample", captureId, sample }),
      onError: (error) => failures.push(`Performance sampling failed: ${String(error)}`),
    }).catch((error) => {
      recorder.close();
      throw error;
    });
    let finishing: Promise<void> | undefined;
    const finish = () =>
      (finishing ??= (async () => {
        try {
          await capture.sample();
          const evidence = restoreRecordedCapture(readPerformanceRecordings(directory), capture.snapshot());
          const summary = summarizePerformanceEvidence(evidence);
          failures.push(...summary.failures);
          const file = `${name}.json`;
          mkdirSync(root, { recursive: true });
          writeFileSync(join(root, file), JSON.stringify({ summary, capture: evidence }));
          emit({ phase: "performance-capture", file, summary, containerId: container?.containerId ?? null });
        } finally {
          recorder.close();
          await capture.close();
        }
      })());
    try {
      runtime = await startScaleRuntime(home, environment);
      await capture.sample();
      return {
        ...runtime,
        stop: async () => {
          try {
            await finish();
          } finally {
            await runtime!.stop();
          }
        },
        // Preserve the workload's immediate kill boundary; missing exit readings remain coverage failures.
        crash: async () => {
          try {
            await runtime!.crash();
          } finally {
            await finish();
          }
        },
      };
    } catch (error) {
      try {
        await finish();
      } finally {
        await runtime?.stop();
      }
      throw error;
    }
  };
  return { start, failures };
};
