import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parentPort, type Worker } from "node:worker_threads";
import { acquirePreparationBuildCommand, isPreparationBuildCommand } from "./preparation-command-slots";

export { preparationBuildConcurrency, withPreparationBuildCommand } from "./preparation-command-slots";

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
  build?: boolean;
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
const captureCommand = async (
  input: CommandInput,
  spawn: (options: Bun.SpawnOptions.OptionsObject<"ignore" | Uint8Array, Bun.BunFile, Bun.BunFile>) => Bun.Subprocess,
) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-extension-command-"));
  try {
    const stdout = join(root, "stdout"),
      stderr = join(root, "stderr");
    const child = spawn({
      ...input,
      stdin: input.stdin === undefined ? "ignore" : Buffer.from(input.stdin),
      stdout: Bun.file(stdout),
      stderr: Bun.file(stderr),
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    return {
      exitCode: await child.exited,
      stdout: await readFile(stdout, "utf8"),
      stderr: await readFile(stderr, "utf8"),
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};
// Spawn and register in the host. No worker can be killed between spawning a child and
// announcing its PID, and a synchronously blocked worker cannot prevent tree termination.
export const ownPreparationCommands = (
  worker: Worker,
  buildState: (state: "waiting" | "admitted" | "started" | "finished") => void = () => {},
) => {
  const children = new Map<string, Bun.Subprocess>();
  const operations = new Set<Promise<void>>();
  let stopped = false;
  const cancelled = new Set<string>();
  const controllers = new Map<string, AbortController>();
  const onMessage = (message: CommandMessage) => {
    if (message.kind === "command-cancel") {
      cancelled.add(message.id);
      controllers.get(message.id)?.abort(new Error("Extension command cancelled."));
      const child = children.get(message.id);
      if (child) void stopChild(child);
      return;
    }
    if (message.kind !== "command" || stopped) return;
    const controller = new AbortController();
    controllers.set(message.id, controller);
    const work = (async () => {
      let release: (() => void) | undefined;
      try {
        if (cancelled.has(message.id)) controller.abort(new Error("Extension command cancelled."));
        if (message.build) {
          const permit = await acquirePreparationBuildCommand(controller.signal, (waiting) =>
            buildState(waiting ? "waiting" : "admitted"),
          );
          buildState("started");
          release = () => {
            permit();
            buildState("finished");
          };
        }
        const result = await captureCommand(message.input, (options) => {
          if (stopped) throw new Error("Extension worker retired.");
          controller.signal.throwIfAborted();
          const child = Bun.spawn(message.input.argv, options);
          children.set(message.id, child);
          return child;
        });
        if (!stopped) worker.postMessage({ kind: "command-result", id: message.id, result });
      } catch (error) {
        if (!stopped)
          worker.postMessage({
            kind: "command-result",
            id: message.id,
            result: commandError(error),
          });
      } finally {
        release?.();
        controllers.delete(message.id);
        children.delete(message.id);
        cancelled.delete(message.id);
      }
    })().finally(() => operations.delete(work));
    operations.add(work);
  };
  worker.on("message", onMessage);
  return async () => {
    stopped = true;
    worker.off("message", onMessage);
    for (const controller of controllers.values()) controller.abort(new Error("Extension worker retired."));
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
    port.postMessage({ kind: "command", id, input, build: isPreparationBuildCommand() });
  });
};
