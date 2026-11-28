import { fileURLToPath } from "node:url";
import type { PreparationEvent } from "pstdio-extensions/preparation-client";
import { isPackagedRuntime } from "pstdio-paths";
import type { WatchUpdate } from "./preparation-watchers";

export type WatchOperation =
  | { task: "watch.update"; input: WatchUpdate }
  | { task: "watch.dispose"; input: { id: string } };
export type WatchRequest = { id: number } & WatchOperation;
export type WatchReply = { id: number; error?: string } | { event: PreparationEvent };

const watchCommand = () =>
  isPackagedRuntime()
    ? [process.execPath, "extension-watch-worker"]
    : [process.execPath, "--no-env-file", fileURLToPath(new URL("./extension-watch-worker.entry.ts", import.meta.url))];

export const createExtensionWatchProcess = (command = watchCommand()) => {
  let child: Bun.Subprocess | undefined;
  let stopped: Promise<void> | undefined;
  let restart: ReturnType<typeof setTimeout> | undefined;
  let nextId = 0;
  const listeners = new Set<(event: PreparationEvent) => void>();
  const pending = new Map<number, ReturnType<typeof Promise.withResolvers<void>>>();

  const rejectPending = (message: string) => {
    for (const reply of pending.values()) reply.reject(new Error(message));
    pending.clear();
  };

  const start = () => {
    const env = { ...process.env };
    delete env.BUN_BE_BUN;
    const launched = Bun.spawn(command, {
      env,
      stdio: ["ignore", "ignore", "inherit"],
      ipc: (raw: WatchReply) => {
        if (child !== launched) return;
        if ("event" in raw) {
          for (const listener of listeners) listener(raw.event);
          return;
        }
        const reply = pending.get(raw.id);
        if (raw.error === undefined) reply?.resolve();
        else reply?.reject(new Error(raw.error));
      },
    });
    child = launched;
    void launched.exited.then(() => {
      if (child !== launched) return;
      child = undefined;
      rejectPending("Extension watch process exited.");
      clearTimeout(restart);
      restart = setTimeout(() => {
        for (const listener of listeners) listener({ kind: "worker-lost" });
      }, 1_000);
      restart.unref();
    });
    return launched;
  };

  const run = async (request: WatchOperation, signal?: AbortSignal) => {
    if (stopped) throw new Error("Extension watch process is stopping.");
    signal?.throwIfAborted();
    if (!child && request.task === "watch.dispose") return;
    const target = child ?? start();
    const id = ++nextId;
    const reply = Promise.withResolvers<void>();
    const abort = () => reply.reject(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    pending.set(id, reply);
    try {
      target.send({ id, ...request });
      await reply.promise;
    } finally {
      pending.delete(id);
      signal?.removeEventListener("abort", abort);
    }
  };

  return {
    run,
    subscribe: (listener: (event: PreparationEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop: () =>
      (stopped ??= (async () => {
        clearTimeout(restart);
        const target = child;
        child = undefined;
        listeners.clear();
        rejectPending("Extension watch process stopped.");
        if (!target) return;
        // Even close can wait on the native FSEvents lock. The child has no app state to flush.
        target.kill("SIGKILL");
        await target.exited;
      })()),
  };
};

export type ExtensionWatchProcess = ReturnType<typeof createExtensionWatchProcess>;
