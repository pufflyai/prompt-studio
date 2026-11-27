import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deserialize } from "node:v8";
import { parentPort, type Worker } from "node:worker_threads";
import { createWindowsProcessJob } from "pstdio-paths/windows-process-job";
import {
  type BackendDefinitionCommandInput,
  type BackendDefinitionResult,
  captureBackendDefinitionCommand,
} from "./preparation-backend-command";
import {
  BUNDLE_START,
  type BundleCommandInput,
  type BundleOutcome,
  captureBundleCommand,
} from "./preparation-bundle-command";
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
  outcome?: BundleOutcome;
  timedOut?: boolean;
  definition?: BackendDefinitionResult;
}
const commandError = (error: unknown) => ({
  exitCode: 1,
  stdout: "",
  stderr: error instanceof Error ? error.message : String(error),
});
type CommandMessage =
  | {
      kind: "command";
      id: string;
      input: CommandInput | BundleCommandInput | BackendDefinitionCommandInput;
      build: boolean;
    }
  | { kind: "command-cancel"; id: string };

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

const stopWindowsBundle = async (
  child: Bun.Subprocess,
  job: ReturnType<typeof createWindowsProcessJob>,
  attached: boolean,
) => {
  try {
    if (!attached) {
      // A bundler without a job never receives permission to start.
      if (child.exitCode === null) child.kill("SIGKILL");
    } else if (job.hasProcesses()) {
      job.terminate();
    }
    const deadline = performance.now() + 1_000;
    while (job.hasProcesses()) {
      if (performance.now() >= deadline) throw new Error("The extension bundler's process job did not stop.");
      await Bun.sleep(20);
    }
    await child.exited;
  } finally {
    job.close();
  }
};

const spawnOwnedCommand = <
  In extends Bun.SpawnOptions.Writable,
  Out extends Bun.SpawnOptions.Readable,
  Err extends Bun.SpawnOptions.Readable,
>(
  argv: string[],
  options: Bun.SpawnOptions.OptionsObject<In, Out, Err>,
  kind?: "bundle",
) => {
  const job = process.platform === "win32" && kind === "bundle" ? createWindowsProcessJob() : undefined;
  const spawn = () => {
    try {
      return Bun.spawn(argv, { ...options, detached: process.platform !== "win32", windowsHide: true });
    } catch (error) {
      job?.close();
      throw error;
    }
  };
  const child = spawn();
  let attached = false;
  let startFailure: { error: unknown } | undefined;
  if (job) {
    try {
      job.attachLauncher(child.pid);
      attached = true;
      child.send(BUNDLE_START);
    } catch (error) {
      startFailure = { error };
    }
  }
  let stopping: Promise<void> | undefined;
  return {
    child,
    stop: () => (stopping ??= job ? stopWindowsBundle(child, job, attached) : stopChild(child)),
    startFailure,
  };
};

export type SpawnOwnedCommand = typeof spawnOwnedCommand;

const captureCommand = async (input: CommandInput, spawn: SpawnOwnedCommand) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-extension-command-"));
  try {
    const stdout = join(root, "stdout"),
      stderr = join(root, "stderr");
    const { child } = spawn(input.argv, {
      cwd: input.cwd,
      env: input.env,
      windowsVerbatimArguments: input.windowsVerbatimArguments,
      stdin: input.stdin === undefined ? "ignore" : Buffer.from(input.stdin),
      stdout: Bun.file(stdout),
      stderr: Bun.file(stderr),
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
  const children = new Map<string, () => Promise<void>>();
  const operations = new Set<Promise<void>>();
  let stopped = false;
  const cancelled = new Set<string>();
  const controllers = new Map<string, AbortController>();
  const onMessage = (message: CommandMessage) => {
    if (message.kind === "command-cancel") {
      cancelled.add(message.id);
      controllers.get(message.id)?.abort(new Error("Extension command cancelled."));
      void children
        .get(message.id)?.()
        .catch(() => {});
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
        const spawn: SpawnOwnedCommand = (argv, options, kind) => {
          if (stopped) throw new Error("Extension worker retired.");
          controller.signal.throwIfAborted();
          const owned = spawnOwnedCommand(argv, options, kind);
          children.set(message.id, owned.stop);
          return owned;
        };
        const capture = () => {
          if ("backendDefinition" in message.input)
            return captureBackendDefinitionCommand(
              message.input,
              (stop) => children.set(message.id, stop),
              () => {
                if (stopped) throw new Error("Extension worker retired.");
                controller.signal.throwIfAborted();
              },
            );
          if ("deadlineMs" in message.input) return captureBundleCommand(message.input, spawn);
          return captureCommand(message.input, spawn);
        };
        const result = await capture();
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
    await Promise.all([...children.values()].map((stop) => stop()));
    await Promise.all(operations);
  };
};
const requestPreparationCommand = (
  input: CommandInput | BundleCommandInput | BackendDefinitionCommandInput,
  build: boolean,
  signal?: AbortSignal,
): Promise<CommandResult> => {
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
    port.postMessage({ kind: "command", id, input, build });
  });
};

export const runPreparationCommand = (input: CommandInput, signal?: AbortSignal) =>
  requestPreparationCommand(input, isPreparationBuildCommand(), signal);

export const readPreparationBackendDefinition = async (
  input: Omit<BackendDefinitionCommandInput, "backendDefinition">,
) => {
  const result = await requestPreparationCommand({ ...input, backendDefinition: true }, false);
  const { BackendUnavailableError, deserializeBackendError } = await import("./backend-process/protocol");
  if (!result.definition) throw new BackendUnavailableError(result.stderr || "Extension definition inspection failed.");
  if (!result.definition.ok) throw deserializeBackendError(result.definition.error);
  return deserialize(result.definition.value);
};

// Revision bundling already occupies its preparation worker slot.
export const runPreparationBundle = (input: BundleCommandInput): Promise<CommandResult> =>
  parentPort ? requestPreparationCommand(input, false) : captureBundleCommand(input, spawnOwnedCommand);
