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
  checkpointTimeoutMs?: number;
}

export const prepareBackendDiagnosticCapture = <TInput extends BackendDiagnosticCaptureInput>(input: TInput) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("Capture input must be an object.");
  const { kind, durationMs, signal } = input;
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw invalid("signal must be an AbortSignal.");
  if (kind === "armed") {
    if (!within(durationMs, MAX_ARMED_DURATION_MS))
      throw invalid(`An armed capture lasts more than 0 and at most ${MAX_ARMED_DURATION_MS} ms.`);
    const { cpuPercent, checkpoint } = input;
    if (!within(cpuPercent, MAX_CPU_PERCENT))
      throw invalid(`The CPU threshold must be more than 0 and at most ${MAX_CPU_PERCENT}%.`);
    if (checkpoint !== undefined && typeof checkpoint !== "function") throw invalid("checkpoint must be a function.");
    return {
      signal,
      run: (lifetime = signal, timing: BackendCaptureTiming = {}) =>
        captureArmedProfile({
          ...timing,
          durationMs,
          thresholdCpuPercent: cpuPercent,
          signal: lifetime,
          checkpoint,
        }) as Promise<BackendDiagnosticCaptureResult<TInput>>,
    };
  }
  if (kind !== "cpu" && kind !== "coverage") throw invalid("kind must be cpu, coverage or armed.");
  if (!within(durationMs, MAX_PROFILE_DURATION_MS))
    throw invalid(`A ${kind} capture lasts more than 0 and at most ${MAX_PROFILE_DURATION_MS} ms.`);
  return {
    signal,
    run: (lifetime = signal) =>
      captureProfile({ kind, durationMs, signal: lifetime }) as Promise<BackendDiagnosticCaptureResult<TInput>>,
  };
};

/** Profiles this process and traces its operations. One recording may use the profiler at a time. */
export const captureBackendDiagnostic = async <TInput extends BackendDiagnosticCaptureInput>(
  input: TInput,
  timing: BackendCaptureTiming = {},
) => prepareBackendDiagnosticCapture(input).run(undefined, timing);
