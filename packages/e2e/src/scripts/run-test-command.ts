import { type SpawnOptionsWithoutStdio, spawn } from "node:child_process";
import { registerPendingTestProcess } from "./pending-test-processes";

export const runTestCommand = async (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
  expectedStatus = 0,
) => {
  const started = performance.now();
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  const lifetime = registerPendingTestProcess(child);
  let stdout = "";
  let stderr = "";
  const captureStdout = (chunk: Buffer) => {
    stdout += chunk.toString();
  };
  const captureStderr = (chunk: Buffer) => {
    stderr += chunk.toString();
    process.stderr.write(`[test command +${Math.round(performance.now() - started)}ms] ${chunk.toString()}`);
  };
  child.stdout.on("data", captureStdout);
  child.stderr.on("data", captureStderr);
  const done = Promise.withResolvers<{ status: number | null; signal: NodeJS.Signals | null }>();
  const onAbort = () => done.reject(lifetime.signal.reason);
  const onError = (error: Error) => done.reject(error);
  const onExit = (status: number | null, signal: NodeJS.Signals | null) => {
    if (status !== expectedStatus || signal) {
      done.reject(new Error(`Test command exited with code ${status}, signal ${signal}\n${stdout}\n${stderr}`));
    }
  };
  const onClose = (status: number | null, signal: NodeJS.Signals | null) => done.resolve({ status, signal });
  lifetime.signal.addEventListener("abort", onAbort, { once: true });
  child.once("error", onError);
  child.once("exit", onExit);
  child.once("close", onClose);
  try {
    return { ...(await done.promise), stdout, stderr };
  } finally {
    lifetime.finish();
    lifetime.signal.removeEventListener("abort", onAbort);
    child.off("error", onError);
    child.off("exit", onExit);
    child.off("close", onClose);
    child.stdout.off("data", captureStdout);
    child.stderr.off("data", captureStderr);
  }
};
