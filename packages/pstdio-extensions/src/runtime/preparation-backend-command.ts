import { serialize } from "node:v8";
import { type SerializedBackendError, serializeBackendError } from "./backend-process/protocol";
import type { BackendWorker } from "./backend-process/supervisor";

export interface BackendDefinitionCommandInput {
  backendDefinition: true;
  command: string[];
  env: Record<string, string | undefined>;
  entryPath: string;
}

export type BackendDefinitionResult = { ok: true; value: Uint8Array } | { ok: false; error: SerializedBackendError };

export const captureBackendDefinitionCommand = async (
  input: BackendDefinitionCommandInput,
  own: (stop: () => Promise<void>) => void,
  check: () => void,
) => {
  let worker: BackendWorker | undefined;
  let stopStarting: (() => Promise<void>) | undefined;
  try {
    const { startBackendWorker } = await import("./backend-process/supervisor");
    check();
    worker = await startBackendWorker({
      command: input.command,
      env: input.env,
      entryPath: input.entryPath,
      onStarting: (stop) => {
        stopStarting = stop;
        own(stop);
      },
    });
    // Preserve Buffer and other v8 clone types across the extra worker-thread hop.
    const value = serialize(worker.definition);
    await worker.stop();
    return { exitCode: 0, stdout: "", stderr: "", definition: { ok: true, value } as BackendDefinitionResult };
  } catch (error) {
    const serialized = serializeBackendError(error);
    return {
      exitCode: 1,
      stdout: "",
      stderr: serialized.message,
      definition: { ok: false, error: serialized } as BackendDefinitionResult,
    };
  } finally {
    if (!worker) await stopStarting?.();
  }
};
