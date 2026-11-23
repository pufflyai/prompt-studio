import type {
  BackendDiagnosticCaptureInput,
  BackendDiagnosticCaptureResult,
} from "pstdio-api-contracts/extension-kernel";
import { captureArmedProfile } from "./armed-profile";
import { diagnosticsError } from "./inspector";
import { captureProfile } from "./profile";

const MAX_PROFILE_DURATION_MS = 60_000;
const MAX_ARMED_DURATION_MS = 24 * 60 * 60_000;
const MAX_CPU_PERCENT = 10_000;

const invalid = (message: string) => diagnosticsError("diagnostics_invalid_input", message);

const within = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max;

/** Window and sampling lengths of armed captures. Tests shorten them; hosts use the defaults. */
export interface BackendCaptureTiming {
  windowMs?: number;
  sampleIntervalMs?: number;
}

/**
 * Profiles this process and traces its runtime operations. One capture runs at a time; another
 * rejects with `diagnostics_busy`. Aborting the signal stops the profiler and rejects.
 */
export const captureBackendDiagnostic = async <TInput extends BackendDiagnosticCaptureInput>(
  input: TInput,
  timing: BackendCaptureTiming = {},
) => {
  // Values arrive from extension code, so the declared type is not trusted.
  const value = input as BackendDiagnosticCaptureInput;
  if (value.kind === "armed") {
    if (!within(value.durationMs, MAX_ARMED_DURATION_MS))
      throw invalid(`An armed capture lasts more than 0 and at most ${MAX_ARMED_DURATION_MS} ms.`);
    if (!within(value.cpuPercent, MAX_CPU_PERCENT))
      throw invalid(`The CPU threshold must be more than 0 and at most ${MAX_CPU_PERCENT}%.`);
    if (value.checkpoint !== undefined && typeof value.checkpoint !== "function")
      throw invalid("checkpoint must be a function.");
    const result = await captureArmedProfile({
      ...timing,
      durationMs: value.durationMs,
      thresholdCpuPercent: value.cpuPercent,
      signal: value.signal,
      checkpoint: value.checkpoint,
    });
    return result as BackendDiagnosticCaptureResult<TInput>;
  }
  if (value.kind !== "cpu" && value.kind !== "coverage") throw invalid("kind must be cpu, coverage or armed.");
  if (!within(value.durationMs, MAX_PROFILE_DURATION_MS))
    throw invalid(`A ${value.kind} capture lasts more than 0 and at most ${MAX_PROFILE_DURATION_MS} ms.`);
  const result = await captureProfile({ kind: value.kind, durationMs: value.durationMs, signal: value.signal });
  return result as BackendDiagnosticCaptureResult<TInput>;
};
