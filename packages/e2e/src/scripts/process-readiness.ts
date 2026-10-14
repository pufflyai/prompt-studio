import type { ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { registerPendingTestProcess } from "./pending-test-processes";

export const waitForProcessReady = async <T>(
  child: ChildProcess,
  label: string,
  check: (signal: AbortSignal) => Promise<T | undefined>,
) => {
  const started = performance.now();
  const lifetime = registerPendingTestProcess(child);
  const controller = new AbortController();
  const abort = () => controller.abort(lifetime.signal.reason);
  lifetime.signal.addEventListener("abort", abort, { once: true });
  let output = "";
  const capture = (chunk: Buffer) => {
    const line = `[${label} +${Math.round(performance.now() - started)}ms] ${chunk.toString()}`;
    output = (output + line).slice(-32_000);
    process.stderr.write(line);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  let onClose: (code: number | null, signal: NodeJS.Signals | null) => void;
  let onError: (error: Error) => void;
  const failed = new Promise<never>((_, reject) => {
    onClose = (code, signal) =>
      reject(new Error(`${label} exited before readiness (code ${code}, signal ${signal})\n${output}`));
    onError = (error) => reject(new Error(`${label} failed to start: ${error.message}\n${output}`));
    child.once("exit", onClose);
    child.once("error", onError);
    if (child.exitCode !== null || child.signalCode !== null) onClose(child.exitCode, child.signalCode);
  });
  const ready = async () => {
    while (!controller.signal.aborted) {
      try {
        const result = await check(controller.signal);
        controller.signal.throwIfAborted();
        if (result !== undefined) return result;
      } catch (error) {
        if (controller.signal.aborted) throw error;
        // Readiness can fail while the process initializes. Its exit ends the wait.
      }
      await sleep(200, undefined, { signal: controller.signal });
    }
    throw controller.signal.reason;
  };
  try {
    return await Promise.race([ready(), failed]);
  } finally {
    controller.abort();
    lifetime.signal.removeEventListener("abort", abort);
    lifetime.finish();
    child.off("exit", onClose!);
    child.off("error", onError!);
    child.stdout?.off("data", capture);
    child.stderr?.off("data", capture);
  }
};
