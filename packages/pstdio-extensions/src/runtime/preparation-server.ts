import { Console } from "node:console";
import { parentPort } from "node:worker_threads";

export type PreparationHandler = (task: string, input: unknown, signal: AbortSignal) => Promise<unknown>;
export const createPreparationHandler =
  <T extends Record<string, (input: never, signal: AbortSignal) => unknown>>(handlers: T): PreparationHandler =>
  async (task, input, signal) => {
    signal.throwIfAborted();
    const handler = handlers[task];
    if (!handler) throw new Error(`Unknown extension preparation task: ${task}`);
    return handler(input as never, signal);
  };
export const serializePreparationError = (error: unknown) => {
  const details = error as
    | { name?: string; message?: string; firstError?: string; diagnostics?: unknown; targetPath?: string }
    | undefined;
  return {
    name: details?.name ?? "Error",
    message: details?.message ?? String(error),
    firstError: details?.firstError,
    diagnostics: details?.diagnostics,
    targetPath: details?.targetPath,
  };
};
export const startPreparationWorker = (handle: PreparationHandler, dispose: () => void | Promise<void> = () => {}) => {
  // Preparation emits diagnostics; stdout belongs to the CLI command and may contain JSON.
  process.stdout.write = process.stderr.write.bind(process.stderr);
  globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr }) as unknown as typeof console;
  const port = parentPort!;
  const operations = new Map<number, AbortController>();
  let shuttingDown = false;
  const work = new Set<Promise<void>>();
  port.on("message", (message) => {
    if (message.kind === "cancel") {
      operations.get(message.id)?.abort();
      return;
    }
    if (message.kind === "shutdown") {
      shuttingDown = true;
      for (const controller of operations.values()) controller.abort();
      // Abort child processes and close watchers before the owner terminates an evaluation
      // that may never settle (for example an extension with an unresolved top-level await).
      void Promise.resolve(dispose())
        .then(() => {
          port.postMessage({ kind: "stopping" });
          return Promise.allSettled([...work]);
        })
        .finally(() => port.close());
      return;
    }
    if (message.kind !== "run" || shuttingDown) return;
    const controller = new AbortController();
    operations.set(message.id, controller);
    // The client serializes jobs, including environment changes. Workers inherit their initial
    // environment; each job carries its app home so tests and separate hosts never share caches.
    for (const key of Object.keys(process.env)) if (!(key in message.env)) delete process.env[key];
    Object.assign(process.env, message.env, { PSTDIO_HOME: message.home });
    const operation = Promise.resolve()
      .then(() => handle(message.task, message.input, controller.signal))
      .then(async (value) => {
        await Bun.sleep(0);
        controller.signal.throwIfAborted();
        if (!shuttingDown) port.postMessage({ id: message.id, value });
      })
      .catch((error) => {
        if (!shuttingDown) {
          port.postMessage({ id: message.id, error: serializePreparationError(error) });
        }
      })
      .finally(() => {
        operations.delete(message.id);
        work.delete(operation);
      });
    work.add(operation);
  });
  port.postMessage({ kind: "ready" });
};

export const publishPreparationEvent = (event: unknown) => parentPort!.postMessage({ kind: "event", event });
