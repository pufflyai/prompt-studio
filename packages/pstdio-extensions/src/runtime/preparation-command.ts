import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parentPort, type Worker } from "node:worker_threads";
import { stopWindowsProcessTree } from "./preparation-windows-process-tree";

interface CommandInput {
  argv: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  windowsVerbatimArguments?: boolean;
}
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
const commandError = (error: unknown) => ({
  exitCode: 1,
  stdout: "",
  stderr: error instanceof Error ? error.message : String(error),
});
interface CommandMessage {
  kind: "command" | "command-cancel";
  id: string;
  input: CommandInput;
}
const stopChild = async (child: Bun.Subprocess) => {
  if (process.platform === "win32") return stopWindowsProcessTree(child);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
  await child.exited;
};
// Spawn and register in the host. No worker can be killed between spawning a child and
// announcing its PID, and a synchronously blocked worker cannot prevent tree termination.
export const ownPreparationCommands = (worker: Worker) => {
  const children = new Map<string, Bun.Subprocess>();
  const operations = new Set<Promise<void>>();
  let stopped = false;
  const cancelled = new Set<string>();
  const onMessage = (message: CommandMessage) => {
    if (message.kind === "command-cancel") {
      cancelled.add(message.id);
      const child = children.get(message.id);
      if (child) void stopChild(child);
      return;
    }
    if (message.kind !== "command" || stopped) return;
    const work = (async () => {
      const root = await mkdtemp(join(tmpdir(), "pstdio-extension-command-"));
      try {
        if (stopped) return;
        if (cancelled.has(message.id)) throw new Error("Extension command cancelled.");
        const stdout = join(root, "stdout");
        const stderr = join(root, "stderr");
        const child = Bun.spawn(message.input.argv, {
          ...message.input,
          stdin: message.input.stdin === undefined ? "ignore" : Buffer.from(message.input.stdin),
          stdout: Bun.file(stdout),
          stderr: Bun.file(stderr),
          detached: process.platform !== "win32",
          windowsHide: true,
        });
        children.set(message.id, child);
        const exitCode = await child.exited;
        const result = { exitCode, stdout: await readFile(stdout, "utf8"), stderr: await readFile(stderr, "utf8") };
        if (!stopped) worker.postMessage({ kind: "command-result", id: message.id, result });
      } catch (error) {
        if (!stopped)
          worker.postMessage({
            kind: "command-result",
            id: message.id,
            result: commandError(error),
          });
      } finally {
        children.delete(message.id);
        cancelled.delete(message.id);
        await rm(root, { recursive: true, force: true });
      }
    })().finally(() => operations.delete(work));
    operations.add(work);
  };
  worker.on("message", onMessage);
  return async () => {
    stopped = true;
    worker.off("message", onMessage);
    await Promise.all([...children.values()].map(stopChild));
    await Promise.all(operations);
  };
};
export const runPreparationCommand = (input: CommandInput, signal?: AbortSignal): Promise<CommandResult> => {
  signal?.throwIfAborted();
  const port = parentPort!;
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    const abort = () => port.postMessage({ kind: "command-cancel", id });
    const onMessage = (message: { kind: string; id: string; result: CommandResult }) => {
      if (message.kind !== "command-result" || message.id !== id) return;
      port.off("message", onMessage);
      signal?.removeEventListener("abort", abort);
      resolve(message.result);
    };
    port.on("message", onMessage);
    signal?.addEventListener("abort", abort, { once: true });
    port.postMessage({ kind: "command", id, input });
  });
};
